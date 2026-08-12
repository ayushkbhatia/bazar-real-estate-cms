import { createHash } from "node:crypto";
import { mask, unmask } from "./mask";
import { SYSTEM_PROMPT, buildPrompt, retryHint } from "./prompt";
import type { MtTarget } from "./targets";
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

export function modelFor(kind: MtTarget["kind"]): string {
  return kind === "alt" ? MT_MODEL_BULK : MT_MODEL_PROSE;
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
    }): Promise<{ content: { type: string; text?: string }[] }>;
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
  return Math.max(512, Math.ceil(text.length * 2.5) + 256);
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
  kind: MtTarget["kind"];
  maxLength?: number;
  /**
   * Arabic for masked proper nouns, keyed by sentinel index. This is how an
   * area gets its hand-authored toponym rather than a fresh transliteration
   * on every record.
   */
  overrides?: Record<number, string>;
}): Promise<TranslateResult> {
  const source = input.text.trim();
  const model = modelFor(input.kind);

  if (source.length === 0) {
    return { ok: false, issues: [{ code: "empty", detail: "nothing to translate" }], raw: "", model };
  }

  const { masked, tokens } = mask(source);
  const prompt = buildPrompt({ text: masked, kind: input.kind, maxLength: input.maxLength });

  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: prompt },
  ];

  let lastRaw = "";
  let lastIssues: Issue[] = [];

  // Two attempts. The retry names the specific failures, which fixes far more
  // than re-rolling the same prompt does; a third attempt has not been worth
  // its latency on anything observed so far.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await input.client.messages.create({
      model,
      max_tokens: maxTokensFor(masked),
      system: SYSTEM_PROMPT,
      messages,
    });

    const out = textOf(response);
    lastRaw = out;
    lastIssues = validate(masked, out, { maxLength: input.maxLength });

    if (lastIssues.length === 0) {
      return {
        ok: true,
        text: unmask(out, tokens, input.overrides),
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
    raw: unmask(lastRaw, tokens, input.overrides),
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
