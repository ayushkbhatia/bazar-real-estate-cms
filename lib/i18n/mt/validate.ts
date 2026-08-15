import { relevantEntries, termRe } from "./glossary";
import { sentinelsIn } from "./mask";

/**
 * Post-hoc checks, run before anything is written.
 *
 * The pipeline's stance is that a translation is guilty until checked: a
 * failure here does not write, it records why and leaves the English showing.
 * An all-English field is the designed fallback and costs nothing; a wrong
 * Arabic field is live for as long as it takes someone who reads Arabic to
 * notice, which on this site could be months.
 *
 * These run on the *masked* model output, before unmasking, because that is
 * the only point where sentinel identity can still be checked.
 */

export type Issue = {
  code:
    | "sentinel-missing"
    | "sentinel-invented"
    | "numeral-drift"
    | "latin-leak"
    | "too-long"
    | "glossary"
    | "markup"
    /**
     * Markdown the English does not have. The model reaches for `**bold**`
     * and `# heading` on short bare inputs — "Hybrid" came back as
     * `**هجين**`, "Annual income · {symbol}" as `**دخل سنوي · ⟦0⟧**` — and
     * next-intl renders it literally, asterisks and all.
     */
    | "markdown"
    /**
     * The model's own working, left in the answer. Real output:
     * `"الملاحظة: يجب أن يكون الناتج بالعربية فقط.\n\nهجين"` — a note to
     * itself, two newlines, then the translation. It renders in full.
     */
    | "multiline"
    /**
     * `امل` at the start of a word, where Arabic wants `الم` — the definite
     * article followed by meem, with the lam and meem transposed.
     * `المساحة` -> `املاحة`, `المدة` -> `املدة`, `الملخص` -> `املخص`.
     */
    | "transposition"
    /**
     * Arabic Presentation Forms, or a stray directional mark.
     *
     * `الإطفاء` came back spelled with U+FEF9 — the isolated *glyph* for
     * lam-alef, not the two letters. It renders identically and breaks
     * everything else: search will not match it, the Arabic FTS config will
     * not stem it, and copy-paste carries a character no keyboard produces.
     * `متغير` arrived with a U+200E LRM glued to the front, which
     * `hasLegacyMarks` does not look for because it only bans the deprecated
     * embedding controls.
     */
    | "presentation-forms"
    /**
     * Arabic bytes decoded as the wrong single-byte codepage and re-encoded.
     * "الانتقال إلى التقرير" arrived as `ุงู„ุงู†ุชู‚ุงู„ ุฅู„ู‰`, which is Thai
     * codepoints — the classic UTF-8-through-cp1256 round trip. Renders as
     * gibberish and looks, to an English reviewer, exactly like Arabic.
     */
    | "mojibake"
    /**
     * The model answering with its data structure rather than its answer:
     * `["غير مفروش"]` instead of `غير مفروش`. Valid Arabic inside valid JSON,
     * so every other check passes.
     */
    | "json-literal"
    /**
     * A Latin letter welded into an Arabic word: `امتb الإمارات` for "United
     * Arab Emirates". Distinct from `latin-leak`, which looks for runs of four
     * or more and so never sees a single stray character, and from `mojibake`,
     * which allows Latin because `AED` and `ft²` are legitimate.
     */
    | "latin-intrusion"
    | "empty"
    /**
     * The API declined the request outright — `stop_reason: "refusal"`, zero
     * output tokens, no content blocks. Separated from `empty` because they
     * call for opposite responses: `empty` means the prompt produced a blank
     * answer and is worth re-prompting, a refusal means the request never ran
     * and is worth re-rolling unchanged. It is also stochastic on innocuous
     * input — "Generating…" and "Attached to your request" both drew one.
     */
    | "refusal"
    /** `stop_reason: "max_tokens"` with nothing usable. Raise the ceiling. */
    | "truncated";
  detail: string;
};

const MAX_GROWTH = 2.2;

/**
 * The same cap, loosened, for sources too short for a ratio to mean much.
 *
 * Short strings were exempt entirely, and short strings are exactly where the
 * model invents. Translating the heading "Who it's for" (12 characters)
 * returned *"استكشف عالم الذكاء الاصطناعي والتعلم الآلي مع خبرائنا"* — "Explore
 * the world of AI and machine learning with our experts", 58 characters of
 * marketing boilerplate with no relationship to the input. It passed every
 * other check in this file: right script, no markdown, no newline, no stray
 * Latin, no numeral drift, plausible-looking Arabic.
 *
 * 4x rather than 2.2x because short English genuinely expands: "TRC" becomes
 * "شهادة الإقامة الضريبية", a ratio of seven. `SHORT_MIN` is the floor that
 * keeps those from tripping — an abbreviation may expand freely, a phrase may
 * not quadruple.
 */
const SHORT_GROWTH = 4;
const SHORT_MIN = 30;

/**
 * An ICU plural, whose length cannot be compared across locales at all.
 *
 * English declares two branches and Arabic six or seven, so a correct
 * translation is *supposed* to be three times longer — `listing.bedrooms` goes
 * from 63 characters to 139 and is right. Measuring the whole message would
 * flag thirteen correct plurals to catch two bad labels.
 */
const IS_PLURAL = /\{\s*\w+\s*,\s*plural\s*,/;

/**
 * Arabic runs longer than English for short strings and the ratio is noisy, so
 * the cap only applies once there is enough text for the ratio to mean
 * anything. Below that a runaway is caught by `too-long` on absolute length.
 */
const RATIO_FLOOR = 40;

/** Digit runs, in any script. A price that changed is the thing to catch. */
function digitRuns(text: string): string[] {
  // Arabic-Indic digits count too — if the model switched numeral systems the
  // multiset comparison should still line up rather than report drift.
  const runs = text.match(/[\d٠-٩۰-۹]+/gu) ?? [];
  return runs.map(toWesternDigits).sort();
}

/** Normalise Arabic-Indic digits to Western so the comparison is script-blind. */
export function toWesternDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/gu, (d) => {
    const c = d.codePointAt(0)!;
    const base = c >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(c - base);
  });
}

/**
 * Latin letter runs of 4+, which in Arabic output means something was left
 * untranslated. Shorter runs are ignored: "AED", "ft", "TV", "AC" and the like
 * are either masked already or legitimately kept.
 */
function latinRuns(text: string): string[] {
  return text.match(/[A-Za-z]{4,}/gu) ?? [];
}

/**
 * A Latin letter directly against an Arabic one, with no space between.
 *
 * Legitimate Latin in Arabic output is a token — `AED`, `ft²`, `BR-1042` —
 * and a token has whitespace or punctuation around it. A letter fused to an
 * Arabic word is a corrupted character, and the one observed produced
 * `امتb الإمارات العربية المتحدة` where the Arabic wanted only the last three
 * words.
 *
 * The Arabic side is Arabic LETTERS, spelled out as ranges rather than as the
 * whole `\u0600-\u06FF` block. The block version flagged `AED 12M، على` — a
 * Latin token against U+060C, the Arabic comma — which is ordinary
 * punctuation and would have failed a perfectly good string.
 *
 * `[[\p{Script=Arabic}&&\p{L}]]` says this far better and is not available:
 * set intersection needs the `v` flag, which needs `target: es2024`, which
 * `next build` does not use even though `tsc --noEmit` here does. That gap is
 * why this was caught by Playwright's own build rather than by the gate.
 */
function latinIntrusions(text: string): string[] {
  return (
    text.match(
      /[\u0621-\u064A\u0671-\u06D3][A-Za-z]|[A-Za-z][\u0621-\u064A\u0671-\u06D3]/gu,
    ) ?? []
  );
}

/**
 * Markdown emphasis and heading markers, which no message in this catalogue
 * uses. Only flagged when the English has none of its own, so a literal
 * asterisk or a `# ` that was always there survives untouched.
 */
function markdownAdded(source: string, output: string): string[] {
  const found: string[] = [];
  const emphasis = /(\*\*|__)(?=\S)[\s\S]+?\1/g;
  if (!emphasis.test(source) && emphasis.test(output)) found.push("bold");
  if (!/^\s*#{1,6}\s/.test(source) && /^\s*#{1,6}\s/.test(output)) {
    found.push("heading");
  }
  if (!/^\s*[-*]\s/m.test(source) && /^\s*[-*]\s/m.test(output)) {
    found.push("bullet");
  }
  return found;
}

/**
 * `امل` opening a word, where the Arabic is `الم`.
 *
 * The definite article `ال` followed by meem, with the lam and meem
 * transposed: `المساحة` comes back `املاحة`, `المدة` as `املدة`, `الملخص` as
 * `املخص`. It survived every other check — right length, right digits, no
 * Latin, no sentinel drift — and `messages/ar/development.json` shipped one in
 * wave 2b (`units.builtUp = "املاحة المبنية"`) because the only instrument
 * that could catch it was a reader of Arabic.
 *
 * Native words beginning `امل` are close to nonexistent; the ones that look
 * like it carry hamza (`إملاء`, U+0625), which this does not match. So a hit
 * is a defect rather than a judgement call.
 */
const TRANSPOSED_ARTICLE = /(?<![\p{L}\p{M}])\u0627\u0645\u0644/gu;

/**
 * Glyphs where letters belong.
 *
 * U+FB50–U+FDFF and U+FE70–U+FEFE are the Arabic Presentation Forms: shaped
 * variants and ligatures that a text renderer produces and a *document* should
 * never contain. U+200E/U+200F are the directional marks — bidi isolation is
 * `lib/i18n/bidi`'s job on the way to the DOM, not something baked into a
 * stored string. U+FEFF is excluded: it is the byte-order mark, a different
 * problem with a different fix.
 */
const PRESENTATION_FORMS = /[\uFB50-\uFDFF\uFE70-\uFEFE\u200E\u200F]/gu;

/**
 * A letter from a script this site does not use.
 *
 * The output is Arabic with Latin runs — currency codes, `ft²`, a reference.
 * Anything else is a decoding accident, and the one observed was a whole
 * string of Thai codepoints where Arabic belonged, which is what UTF-8 Arabic
 * looks like after a trip through cp1256. Checked as "letter outside Arabic
 * and Latin" rather than "in the Thai block" so the next codepage does not
 * need its own rule.
 */
function foreignScript(text: string): string[] {
  return [
    ...new Set(
      [...text].filter(
        (c) =>
          /\p{L}/u.test(c) &&
          !/[\u0600-\u06FF\u0750-\u077F]/u.test(c) &&
          !/[A-Za-z]/.test(c),
      ),
    ),
  ];
}

export function validate(
  sourceMasked: string,
  outputMasked: string,
  opts: { maxLength?: number } = {},
): Issue[] {
  const issues: Issue[] = [];
  const output = outputMasked.trim();

  if (output.length === 0) {
    return [{ code: "empty", detail: "model returned nothing" }];
  }

  const md = markdownAdded(sourceMasked, output);
  if (md.length > 0) {
    issues.push({
      code: "markdown",
      detail: `output added markdown the English does not have: ${md.join(", ")}`,
    });
  }

  // The model narrating before it answers. Every catalogue message and every
  // listing field this pipeline touches is a single run of text, so a newline
  // the English does not have is working left in the output rather than
  // content — real example: "الملاحظة: يجب أن يكون الناتج بالعربية فقط" and
  // then, two newlines later, the actual translation.
  if (!sourceMasked.includes("\n") && output.includes("\n")) {
    issues.push({
      code: "multiline",
      detail: `output has ${output.split("\n").length - 1} newline(s) the English does not — likely the model's own working`,
    });
  }

  const fused = latinIntrusions(output);
  if (fused.length > 0) {
    issues.push({
      code: "latin-intrusion",
      detail: `Latin letter fused to an Arabic word: ${[...new Set(fused)].slice(0, 4).join(", ")}`,
    });
  }

  const foreign = foreignScript(output);
  if (foreign.length > 0) {
    issues.push({
      code: "mojibake",
      detail: `letters from another script: ${foreign
        .slice(0, 6)
        .map((c) => `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase()})`)
        .join(", ")} — Arabic bytes decoded as the wrong codepage`,
    });
  }

  // `["غير مفروش"]` — the answer wrapped in the shape it was asked for.
  if (/^\s*[[{]/.test(output)) {
    try {
      JSON.parse(output);
      issues.push({
        code: "json-literal",
        detail: "output is a JSON value, not the translation it contains",
      });
    } catch {
      // Prose that merely opens with a bracket is fine.
    }
  }

  const shaped = output.match(PRESENTATION_FORMS);
  if (shaped) {
    issues.push({
      code: "presentation-forms",
      detail: `${shaped.length} presentation-form or directional character(s): ${[
        ...new Set(shaped),
      ]
        .map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`)
        .join(", ")} — write the letters, not the glyphs`,
    });
  }

  const transposed = output.match(TRANSPOSED_ARTICLE);
  if (transposed) {
    issues.push({
      code: "transposition",
      detail: `${transposed.length} word(s) begin امل where Arabic wants الم — the definite article's lam and meem are swapped`,
    });
  }

  // ── Sentinel integrity. Identity, not order: Arabic reorders, and a
  // sentinel legitimately moves within the sentence.
  const wanted = new Set(sentinelsIn(sourceMasked));
  const got = new Set(sentinelsIn(output));
  for (const n of wanted) {
    if (!got.has(n)) {
      issues.push({ code: "sentinel-missing", detail: `⟦${n}⟧ dropped` });
    }
  }
  for (const n of got) {
    if (!wanted.has(n)) {
      issues.push({ code: "sentinel-invented", detail: `⟦${n}⟧ not in source` });
    }
  }

  // ── Numeral drift. Anything numeric that was NOT masked — a bedroom count,
  // a floor number — must survive unchanged. A hallucinated figure here is
  // the same class of problem as a hallucinated price, just less obvious.
  const before = digitRuns(sourceMasked.replace(/⟦\s*\d+\s*⟧/gu, ""));
  const after = digitRuns(output.replace(/⟦\s*\d+\s*⟧/gu, ""));
  if (before.join("|") !== after.join("|")) {
    issues.push({
      code: "numeral-drift",
      detail: `numbers changed: [${before.join(", ")}] became [${after.join(", ")}]`,
    });
  }

  // ── Untranslated Latin left in the output.
  //
  // Every 4+ Latin run counts, whether or not it was in the source. One that
  // was is a phrase the model skipped; one that was not is invented. Neither
  // belongs in an Arabic listing, and the distinction changes nothing about
  // what to do.
  //
  // This is also what forces callers to mask proper nouns: an area or
  // development name left unmasked surfaces here rather than being quietly
  // transliterated differently on every record.
  const leaked = latinRuns(output);
  if (leaked.length > 0) {
    issues.push({
      code: "latin-leak",
      detail: `untranslated: ${[...new Set(leaked)].slice(0, 5).join(", ")}`,
    });
  }

  // ── Length. Two caps: the column/design limit, and runaway growth.
  if (opts.maxLength && output.length > opts.maxLength) {
    issues.push({
      code: "too-long",
      detail: `${output.length} chars over the ${opts.maxLength} limit`,
    });
  }
  if (IS_PLURAL.test(sourceMasked)) {
    // Skip both growth caps — see IS_PLURAL.
  } else if (
    sourceMasked.length >= RATIO_FLOOR &&
    output.length > sourceMasked.length * MAX_GROWTH
  ) {
    issues.push({
      code: "too-long",
      detail: `${output.length} chars from ${sourceMasked.length} — the model probably explained itself`,
    });
  } else if (
    sourceMasked.length < RATIO_FLOOR &&
    output.length > Math.max(SHORT_MIN, sourceMasked.length * SHORT_GROWTH)
  ) {
    issues.push({
      code: "too-long",
      detail: `${output.length} chars from a ${sourceMasked.length}-char label — far past what translation costs, so the model wrote something of its own`,
    });
  }

  // ── Glossary. Only entries whose English term is actually in the source.
  for (const entry of relevantEntries(sourceMasked)) {
    for (const bad of entry.forbidden ?? []) {
      if (output.includes(bad)) {
        issues.push({
          code: "glossary",
          detail: `"${entry.en}" rendered as ${bad}; must be ${entry.ar}`,
        });
      }
    }
    if (!output.includes(entry.stem) && !termRe(entry.en).test(output)) {
      issues.push({
        code: "glossary",
        detail: `"${entry.en}" has no rendering containing ${entry.stem}`,
      });
    }
  }

  return issues;
}
