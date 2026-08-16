import { createHash } from "node:crypto";
import { mask, unmask } from "./mask";
import { overridesFor } from "./proper-nouns";
import { buildPrompt, retryHint, systemPromptFor, type MtKind } from "./prompt";
import { validate, type Issue } from "./validate";

/**
 * One field in, one Arabic string out — or a refusal with reasons.
 *
 * The order is the point: mask, translate, validate the *masked* output, then
 * unmask. Validation has to happen before unmasking because that is the only
 * moment sentinel identity can still be checked; once the real prices are back
 * in the string there is no way to tell a preserved one from a re-invented one.
 *
 * Failure is a first-class result rather than an exception. A rejected
 * translation leaves the English showing, which is the designed public
 * fallback and costs nothing, so there is no reason for a caller to have to
 * catch anything.
 */

/** Prose gets Opus; alt text is bulk and short, so Haiku is enough. */
export const MT_MODEL_PROSE = "claude-opus-5";
export const MT_MODEL_BULK = "claude-haiku-4-5-20251001";

export function modelFor(kind: MtKind): string {
  return kind === "alt" ? MT_MODEL_BULK : MT_MODEL_PROSE;
}

/**
 * Where to go when the primary model declines the request outright.
 *
 * `stop_reason: "refusal"` is the API's own gate, and on this system prompt it
 * is **not** stochastic: eight strings in the `tools` namespace drew it on
 * every one of four rolls, including copy as plain as "Generating…" and
 * "Attached to your request". Batching them into one request did not help
 * either, so it is not about how little context a short string carries.
 *
 * What does help is a different model. `claude-haiku-4-5` answers the same
 * eight without hesitating — and they are two-to-four-word interface labels,
 * the exact register the bulk model already handles for alt text. So a refusal
 * falls back rather than failing, and `Provenance.model` records which model
 * actually produced the string, which is the point of recording it.
 *
 * Null for `alt`, which is already on the bulk model: there is nowhere below
 * it to fall, and a loop between the two would be worse than a clean failure.
 */
export function fallbackModelFor(kind: MtKind): string | null {
  return kind === "alt" ? null : MT_MODEL_BULK;
}

/**
 * The slice of the Anthropic SDK this needs, so tests inject a fake and CI
 * never calls the real API — the same arrangement the concierge uses.
 */
export type MtClient = {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user" | "assistant"; content: string }[];
    }): Promise<{
      content: { type: string; text?: string }[];
      /**
       * Why the model stopped. Optional because the fakes in
       * `translate.test.ts` do not set it, and because the only value that
       * changes behaviour here is `"refusal"` — anything else falls through
       * to the same validation it always had.
       */
      stop_reason?: string | null;
    }>;
  };
};

export type TranslateOk = {
  ok: true;
  text: string;
  model: string;
  /** True when the first attempt was rejected and the retry succeeded. */
  retried: boolean;
};

export type TranslateFail = {
  ok: false;
  issues: Issue[];
  /** The rejected output, unmasked, so a reviewer can see what happened. */
  raw: string;
  model: string;
};

export type TranslateResult = TranslateOk | TranslateFail;

/**
 * Arabic tokenises far less efficiently than English — roughly 2.5x — so the
 * ceiling is generous relative to the source. The same arithmetic the
 * concierge's ceilings were corrected for in P0.
 */
function maxTokensFor(text: string): number {
  /*
   * The floor is 1024 rather than 512 because the ceiling has to cover what
   * the model writes, not what it keeps. Asked for a short fragment it
   * sometimes reasons aloud first — "\"Term\" on a form (e.g. loan term) =
   * المدة" — and on a 32-character input a 512 ceiling ran out mid-deliberation
   * and returned `stop_reason: "max_tokens"` with no text at all. Unused
   * ceiling is free; a truncation costs the whole string.
   */
  return Math.max(1024, Math.ceil(text.length * 2.5) + 256);
}

function textOf(response: { content: { type: string; text?: string }[] }): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

export async function translateField(input: {
  client: MtClient;
  text: string;
  kind: MtKind;
  maxLength?: number;
  /**
   * Arabic for masked proper nouns, keyed by sentinel index. This is how an
   * area gets its hand-authored toponym rather than a fresh transliteration
   * on every record.
   */
  overrides?: Record<number, string>;
  /**
   * Place, developer and project names to protect and substitute.
   *
   * Passed as a map rather than as a sentinel-keyed `overrides` because the
   * indices depend on what `mask` matched, which the caller cannot know before
   * calling it. Supplying this is what makes `overrides` reachable at all —
   * see `lib/i18n/mt/proper-nouns.ts`.
   */
  properNouns?: Map<string, string | null>;
  /**
   * Extra checks on the raw output, run beside the standard ones and folded
   * into the same retry.
   *
   * This exists for the HTML path: a block of rich text carries `⟦mN⟧`
   * formatting markers as well as content sentinels, and a dropped `<strong>`
   * deserves the same second chance a dropped price gets. Keeping it a
   * parameter rather than teaching `validate` about markup keeps the validator
   * ignorant of HTML, which is the reason it is easy to reason about.
   */
  extraIssues?: (output: string) => string[];
}): Promise<TranslateResult> {
  const source = input.text.trim();
  const primary = modelFor(input.kind);
  // Reassigned once, if the primary refuses — see `fallbackModelFor`.
  let model = primary;

  if (source.length === 0) {
    return { ok: false, issues: [{ code: "empty", detail: "nothing to translate" }], raw: "", model };
  }

  const { masked, tokens, kinds } = mask(
    source,
    input.properNouns ? [...input.properNouns.keys()] : undefined,
  );
  // Caller-supplied overrides win, so the low-level escape hatch still works.
  const overrides = {
    ...overridesFor({ tokens, kinds }, input.properNouns),
    ...(input.overrides ?? {}),
  };
  const prompt = buildPrompt({ text: masked, kind: input.kind, maxLength: input.maxLength });

  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: prompt },
  ];

  let lastRaw = "";
  let lastIssues: Issue[] = [];

  /*
   * Two answered attempts, and separately a few re-rolls for answers that
   * never arrived. They are counted apart because they are different failures
   * and the right response to each is the opposite of the other.
   *
   * A badly translated field is rejected by `validate`, and what fixes it is a
   * retry that names what was wrong — which is why the loop appends the
   * exchange and a hint. Two of those; a third has not been worth its latency
   * on anything observed.
   *
   * But the API also declines requests outright: `stop_reason: "refusal"`,
   * zero output tokens, no content blocks at all. Translating the `tools`
   * namespace drew eleven in one run on copy as plain as "Generating…", so the
   * trigger is stochastic rather than anything in the text. There is nothing
   * to correct and nothing to hint at — the fix is to roll again.
   *
   * Before the loop could tell them apart it did the worst available thing
   * with a refusal. `validate` reported `empty — model returned nothing`,
   * naming the symptom and no cause. And the retry pushed
   * `{role: "assistant", content: ""}` onto the conversation, which is not a
   * legal turn — so the one retry the string was going to get was spent on a
   * malformed history rather than on another roll.
   *
   * A re-roll therefore leaves both the history and the attempt count alone,
   * and only `MAX_REROLLS` bounds it. Zero output tokens means it is close to
   * free; the ceiling is there so a systematic refusal cannot spin.
   */
  const MAX_REROLLS = 3;
  let rerolls = 0;
  let switched = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await input.client.messages.create({
      model,
      max_tokens: maxTokensFor(masked),
      system: systemPromptFor(input.kind),
      messages,
    });

    const out = textOf(response);
    lastRaw = out;

    if (out.length === 0) {
      const stop = response.stop_reason ?? "unknown";
      lastIssues = [
        {
          code:
            stop === "refusal"
              ? "refusal"
              : stop === "max_tokens"
                ? "truncated"
                : "empty",
          detail: `no text returned (stop_reason=${stop})`,
        },
      ];
      // A truncation is answerable — the ceiling is ours to raise — so it
      // burns an attempt like any other bad answer. A refusal and an
      // unexplained blank are not, so they re-roll unchanged.
      if (stop !== "max_tokens" && rerolls < MAX_REROLLS) {
        rerolls++;
        attempt--;
        continue;
      }
      // Out of re-rolls on a refusal: try the other model once, from a clean
      // count. Everything else has already had every chance it is going to get.
      const fallback = switched ? null : fallbackModelFor(input.kind);
      if (stop === "refusal" && fallback && fallback !== model) {
        switched = true;
        model = fallback;
        rerolls = 0;
        attempt--;
        continue;
      }
      break;
    }

    lastIssues = [
      ...validate(masked, out, { maxLength: input.maxLength }),
      ...(input.extraIssues?.(out) ?? []).map((detail) => ({
        code: "markup" as const,
        detail,
      })),
    ];

    if (lastIssues.length === 0) {
      return {
        ok: true,
        text: unmask(out, tokens, overrides),
        model,
        retried: attempt > 0,
      };
    }

    messages.push({ role: "assistant", content: out });
    messages.push({ role: "user", content: retryHint(lastIssues) });
  }

  return {
    ok: false,
    issues: lastIssues,
    // Unmasked so a reviewer reads real text rather than sentinels. It is not
    // written anywhere public — only shown in the failure surface.
    raw: unmask(lastRaw, tokens, overrides),
    model,
  };
}

/**
 * Provenance for one translated field.
 *
 * `src_hash` is what makes staleness detectable. Without it, an editor fixing
 * a typo in an English title leaves the Arabic looking current forever, and
 * the CMS has no way to say otherwise.
 */
export type Provenance = {
  source: "machine" | "edited" | "human";
  model?: string;
  at: string;
  src_hash: string;
};

export function hashSource(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}

export function machineProvenance(
  english: string,
  model: string,
  at: string,
): Provenance {
  return { source: "machine", model, at, src_hash: hashSource(english) };
}

/** True when the English has changed since this Arabic was produced. */
export function isStale(english: string, prov: Provenance | undefined): boolean {
  if (!prov) return false;
  return prov.src_hash !== hashSource(english);
}
