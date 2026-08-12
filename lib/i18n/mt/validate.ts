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
    | "empty";
  detail: string;
};

const MAX_GROWTH = 2.2;

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
  if (
    sourceMasked.length >= RATIO_FLOOR &&
    output.length > sourceMasked.length * MAX_GROWTH
  ) {
    issues.push({
      code: "too-long",
      detail: `${output.length} chars from ${sourceMasked.length} — the model probably explained itself`,
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
