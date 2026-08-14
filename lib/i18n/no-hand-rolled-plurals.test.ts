/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * G-14 — no English plural morphology written by hand.
 *
 * ```ts
 * `${n} bedroom${n === 1 ? "" : "s"}`
 * ```
 *
 * This is not an untranslated string. It is a string that **cannot** be
 * translated, and that distinction is the whole point of the rule.
 *
 * English has two plural categories. Arabic has six — `zero`, `one`, `two`,
 * `few`, `many`, `other` — and `messages.test.ts:139` fails any Arabic message
 * that declares fewer. A ternary on `n === 1` has nowhere to put a dual or a
 * paucal, so no amount of translation effort recovers it; the sentence has to
 * be rewritten as an ICU message first. `docs/I18N.md:85` says exactly this,
 * and calls it "the single reason the project uses next-intl rather than a
 * hand-rolled t()".
 *
 * The first two entries were the worst of them — `filter-bar.tsx` and
 * `hero-search.tsx` re-implemented a six-category ICU message by hand. Wave 1b
 * converted both, and the ceiling dropped 11 -> 9. That is the mechanism
 * working: every wave takes its own files off this list.
 *
 * ## Shape
 *
 * Modelled on `lib/rtl/no-physical-utilities.test.ts` (G-5), which is this
 * repo's proven pattern for "no un-extracted X anywhere in the tree": a vitest
 * file over `git ls-files`, comments stripped, with an allowlist that may only
 * shrink. Not an ESLint plugin — there is no i18n lint dependency here and
 * adding one to express a single rule is a poor trade.
 *
 * `ALLOWED` is the set of files that carried the idiom when this landed. Each
 * extraction wave deletes its own entries as it converts them to ICU. The list
 * reaching empty is one of the things that means the wave work is done.
 *
 * ## Scope
 *
 * Public surfaces and the shared library only. The CMS is English permanently
 * (ADR-0007 §6) and PDFs stay English (docs/I18N.md), so the idiom is correct
 * there and banning it would be noise a contributor learns to route around.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/**
 * English plural morphology chosen by a ternary. Deliberately narrow: it
 * matches the *decision*, not any use of the number, so `n === 1 ? a : b`
 * over two unrelated words does not trip it.
 */
const HAND_ROLLED =
  /[?]\s*(?:""|"s"|"es"|"y"|"ies"|"has"|"is"|"was")\s*:\s*(?:""|"s"|"es"|"y"|"ies"|"have"|"are"|"were")/;

/**
 * Files that already contained the idiom. **Shrink only.**
 *
 * Adding an entry here instead of writing an ICU message is the one move that
 * would quietly undo this file, which is why the count is asserted below.
 */
const ALLOWED: readonly string[] = [
  "app/[locale]/(public)/concierge/_chat.tsx",
  "app/[locale]/(public)/market-reports/_components/report-hero.tsx",
  "app/[locale]/(public)/tools/valuation/valuation-wizard.tsx",
  "lib/concierge/handoff.ts",
  "lib/page-builder/publishability.ts",
  "lib/schemas/content-asset.ts",
];

/** What the allowlist held when the rule landed. Lowering it is the point. */
const ALLOWED_CEILING = 6;

/** Strip comments so a docblock describing the idiom does not trip on it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function scannedFiles(): string[] {
  return (
    execFileSync(
      "git",
      [
        "ls-files",
        /*
         * The brackets are ESCAPED, and that is load-bearing. In a git
         * pathspec `[locale]` is a character class matching one of l/o/c/a/e,
         * so the unescaped form matches the literal directory zero times — the
         * guard then scans only components/ and lib/ and passes vacuously.
         *
         * Found by mutation-testing this file rather than by reading it: an
         * offender planted in agents/page.tsx went undetected. The file-count
         * assertion below is the standing version of that check.
         */
        "app/\\[locale\\]/(public)/**/*.ts",
        "app/\\[locale\\]/(public)/**/*.tsx",
        "components/brand/**/*.tsx",
        "lib/**/*.ts",
        "lib/**/*.tsx",
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .filter((f) => !/\.test\.tsx?$/.test(f))
      // English by decision, so the idiom is correct in both.
      .filter((f) => !f.startsWith("lib/pdf/"))
  );
}

describe("G-14 · no hand-rolled English plurals", () => {
  it("finds none outside the allowlist", () => {
    const offenders: string[] = [];

    for (const file of scannedFiles()) {
      if (ALLOWED.includes(file)) continue;
      const src = stripComments(readFileSync(join(REPO_ROOT, file), "utf8"));
      src.split("\n").forEach((line, i) => {
        if (HAND_ROLLED.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }

    expect(
      offenders,
      `English plural morphology written by hand:\n${offenders.join("\n")}\n\n` +
        `Arabic needs six plural categories and a \`n === 1\` ternary can only ` +
        `express two, so this cannot be translated later — it has to become an ` +
        `ICU message. Use t("namespace.key", { count }) with a message like\n` +
        `  {count, plural, =0 {…} one {…} other {…}}\n` +
        `and let scripts/i18n/translate-catalogue.ts produce the Arabic forms.\n\n` +
        `Do NOT add the file to ALLOWED — that list is closed.`,
    ).toEqual([]);
  });

  it("only ever lets the allowlist shrink", () => {
    expect(ALLOWED.length).toBeLessThanOrEqual(ALLOWED_CEILING);
    expect(new Set(ALLOWED).size).toBe(ALLOWED.length);
  });

  it("keeps the allowlist honest", () => {
    // An entry that no longer contains the idiom is a wave that converted it
    // and forgot to delete the line. Harmless, but it hides progress and makes
    // the ceiling meaningless.
    const stale = ALLOWED.filter((file) => {
      const src = stripComments(readFileSync(join(REPO_ROOT, file), "utf8"));
      return !src.split("\n").some((l) => HAND_ROLLED.test(l));
    });
    expect(
      stale,
      `These files no longer hand-roll a plural — remove them from ALLOWED ` +
        `and lower ALLOWED_CEILING:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  it("scans a believable number of files", () => {
    expect(scannedFiles().length).toBeGreaterThan(450);
  });
});
