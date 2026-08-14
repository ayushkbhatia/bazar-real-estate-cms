import {
  ARABIC_PLURAL_CATEGORIES,
  formatPlural,
  hasEmbeddedPlural,
  icuArguments,
  parseMessage,
  requiredArabicSelectors,
  type PluralBranch,
} from "./icu";
import { mask, sentinelsIn, unmask } from "./mt/mask";
import { hasLegacyMarks } from "./bidi";

/**
 * Translating the message catalogue, as opposed to database columns.
 *
 * The existing pipeline in `lib/i18n/mt/` already does the hard parts —
 * sentinel masking so a price never reaches the model, the binding glossary,
 * numeral-drift and Latin-leak validation, a retry that names its failures. And
 * `translateField` takes `{ client, text, kind, maxLength }`: plain text, no
 * table, no column. So the catalogue can use it as-is.
 *
 * What it cannot do as-is is plurals, and that is the whole reason this module
 * exists rather than a twenty-line script.
 *
 * ## Why plurals get their own prompt
 *
 * `{count, plural, =0 {Studio} one {# bedroom} other {# bedrooms}}` is not
 * prose. Handed to a prose translator it comes back as prose — the ICU
 * structure mangled, or the branches translated into a sentence. And English
 * offers only two categories to translate *from*, while Arabic requires six:
 * `zero`, `one`, `two`, `few`, `many`, `other`. The information for `two` and
 * `few` is not in the English at all. It has to be generated from the meaning,
 * which is a different task with a different prompt.
 *
 * So: simple messages go through `translateField` untouched. Plurals are
 * decomposed, translated as a *set* of forms, and reassembled here — with the
 * exact-match branches (`=0 {Studio}`) carried across verbatim, because those
 * are product decisions about a specific number rather than grammar.
 */

export type MtClient = {
  messages: {
    create(input: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user" | "assistant"; content: string }[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
};

export type CatalogueIssue = { code: string; detail: string };

export type CatalogueResult =
  | { ok: true; value: string; kind: "simple" | "plural" }
  | { ok: false; issues: CatalogueIssue[] };

const PLURAL_SYSTEM = `You produce Arabic plural forms for a property marketplace in Abu Dhabi.

You are given the English forms of one countable phrase, keyed by ICU selector.

Return a JSON object whose keys are:
  - every one of Arabic's six CLDR categories: zero, one, two, few, many, other
  - PLUS every exact-match selector present in the input (e.g. "=0"), unchanged

An exact-match selector is a product decision about one specific number, not a
grammatical category, so it must come back as its own key. Returning only the
six categories is the most common mistake here.

Rules:
- Output ONLY the JSON object. No prose, no code fence.
- Keep the placeholder # exactly where the number belongs. The =0 and one forms
  often read better without it; every other form needs it.
- Gulf-facing register. Natural, not a literal rendering of the English.
- Never translate, reorder or drop a ⟦N⟧ marker. Reproduce each one exactly.
- Western digits only.`;

function textOf(res: { content: { type: string; text?: string }[] }): string {
  return res.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

/**
 * Shared post-checks, run on whichever path produced the Arabic.
 *
 * `translateField` already validates its own output; these are the catalogue's
 * additional invariants, and every one of them has a matching assertion in
 * `messages.test.ts`. Catching them here means a bad run is a script failure
 * with a named cause rather than a red suite after the fact.
 */
export function catalogueIssues(
  english: string,
  arabic: string,
): CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];

  if (arabic.trim().length === 0) {
    return [{ code: "empty", detail: "model returned nothing" }];
  }
  if (arabic.trim() === english.trim()) {
    // messages.test.ts:107 rejects this outright — and it is the exact shape of
    // "someone pasted the English in to make the test pass".
    issues.push({
      code: "identical",
      detail: "Arabic is the English verbatim",
    });
  }

  const before = icuArguments(english).join(",");
  const after = icuArguments(arabic).join(",");
  if (before !== after) {
    issues.push({
      code: "placeholder-drift",
      detail: `arguments changed: {${before}} -> {${after}}`,
    });
  }

  if (hasLegacyMarks(arabic)) {
    issues.push({
      code: "legacy-bidi",
      detail: "output carries a deprecated embedding/override mark",
    });
  }

  /*
   * `#` is ICU's number placeholder inside a plural branch. Checked in BOTH
   * directions, because the one-sided version missed a real failure on the
   * first production run: translating "Currency & units" came back as
   * "# العملة والوحدات" — a `#` invented out of nothing, which formats as a
   * literal hash on the page outside a plural and throws inside one.
   */
  const hashesIn = (s: string) => (s.match(/#/g) ?? []).length;
  const enHashes = hashesIn(english);
  const arHashes = hashesIn(arabic);
  if (enHashes > 0 && arHashes === 0) {
    issues.push({
      code: "hash-dropped",
      detail: "the # number placeholder is missing from the Arabic",
    });
  }
  if (enHashes === 0 && arHashes > 0) {
    issues.push({
      code: "hash-invented",
      detail: `the Arabic gained ${arHashes} # not present in the English`,
    });
  }

  return issues;
}

/**
 * Translate one plural message: decompose, ask for the six forms, reassemble.
 *
 * The English branch bodies are masked before the model sees them, so a `⟦0⟧`
 * standing in for a price or a reference survives into every one of the six
 * Arabic forms and is restored afterwards.
 */
export async function translatePluralMessage(input: {
  client: MtClient;
  message: string;
  model: string;
}): Promise<CatalogueResult> {
  const parsed = parseMessage(input.message);
  if (parsed.kind !== "plural") {
    return {
      ok: false,
      issues: [{ code: "not-plural", detail: input.message }],
    };
  }

  const masked = parsed.branches.map((b) => ({
    selector: b.selector,
    ...mask(b.text),
  }));
  // One token table across all branches keeps sentinel numbering stable, which
  // is what lets the same ⟦0⟧ mean the same thing in every form.
  const tokens = masked.flatMap((m) => m.tokens);

  const englishForms = Object.fromEntries(
    masked.map((m) => [m.selector, m.masked]),
  );

  const res = await input.client.messages.create({
    model: input.model,
    max_tokens: 1200,
    system: PLURAL_SYSTEM,
    messages: [
      {
        role: "user",
        content: `English forms:\n${JSON.stringify(englishForms, null, 2)}`,
      },
    ],
  });

  let forms: Record<string, string>;
  try {
    const raw = textOf(res).replace(/^```(?:json)?\s*|\s*```$/g, "");
    forms = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      issues: [{ code: "unparseable", detail: textOf(res).slice(0, 200) }],
    };
  }

  const missing = ARABIC_PLURAL_CATEGORIES.filter((c) => !forms[c]?.trim());
  if (missing.length > 0) {
    return {
      ok: false,
      issues: [{ code: "missing-category", detail: missing.join(", ") }],
    };
  }

  const branches: PluralBranch[] = [];
  // Exact-match branches carry across from the English structure: `=0 {Studio}`
  // is a decision about the number zero, not a grammatical category, and it
  // must stay its own branch.
  for (const b of parsed.branches) {
    if (!b.selector.startsWith("=")) continue;
    const arabic = forms[b.selector];
    if (!arabic?.trim()) {
      return {
        ok: false,
        issues: [
          { code: "missing-exact", detail: `${b.selector} has no Arabic form` },
        ],
      };
    }
    branches.push({ selector: b.selector, text: arabic });
  }
  for (const cat of ARABIC_PLURAL_CATEGORIES) {
    branches.push({ selector: cat, text: forms[cat]! });
  }

  const wanted = new Set(sentinelsIn(masked.map((m) => m.masked).join(" ")));
  const rebuilt = formatPlural(parsed.arg, branches);
  for (const n of wanted) {
    if (!sentinelsIn(rebuilt).includes(n)) {
      return {
        ok: false,
        issues: [{ code: "sentinel-missing", detail: `⟦${n}⟧ dropped` }],
      };
    }
  }

  const value = unmask(rebuilt, tokens);
  const issues = catalogueIssues(input.message, value);
  const selectors = new Set(branches.map((b) => b.selector));
  for (const need of requiredArabicSelectors(parsed.branches)) {
    if (!selectors.has(need)) {
      issues.push({ code: "missing-selector", detail: need });
    }
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value, kind: "plural" };
}

/**
 * Messages this module refuses rather than guesses at.
 *
 * A plural embedded mid-sentence would parse as simple prose and be handed to
 * the prose model whole, which mangles the ICU structure quietly. There are
 * none in the catalogue and the waves should not add any — a message that is
 * entirely its plural is easier to translate and easier to read.
 */
export function refuse(message: string): CatalogueIssue | null {
  if (hasEmbeddedPlural(message)) {
    return {
      code: "embedded-plural",
      detail:
        "a plural must wrap the whole message, not sit inside a sentence — " +
        "split the sentence into two keys",
    };
  }
  return null;
}
