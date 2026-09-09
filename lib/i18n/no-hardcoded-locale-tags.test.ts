/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * G-19 — no BCP-47 tag written by hand into a `toLocale*String` call.
 *
 * ```ts
 * new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
 * ```
 *
 * A visitor reading `/ar` gets "14 Mar 2026" under a headline, excerpt, byline
 * and category chip that were all translated. `lib/i18n/dates.ts` exists to fix
 * exactly this and shipped in #505 — but shipping a helper does not stop the
 * next call site being written the old way, and it did not stop the six that
 * were already there.
 *
 * ## Why this needs its own guard rather than the two we had
 *
 * Neither existing i18n ratchet can see this, and the reasons are worth
 * writing down because they are the same reasons it survived so long:
 *
 * - **G-13** (`no-unextracted-literals`) looks for JSX text nodes, word-props
 *   and toast calls. `"en-GB"` is an argument to a method, in none of those
 *   positions, and would not be UI copy even if it were.
 * - **G-14** (`no-hand-rolled-plurals`) looks for a plural *decision* —
 *   `n === 1 ? "" : "s"`. There is no decision here at all.
 *
 * So the literal is invisible to every guard, produces no error, renders
 * perfectly in English, and only misbehaves in a language most reviewers do
 * not read. That combination is what a ratchet is for.
 *
 * ## What is checked, and what is deliberately not
 *
 * The tag, not the options. Six public surfaces format dates six different
 * ways — /press writes the month in full, /agents omits the day, the listing
 * page and the market-report comparables pin `timeZone: "UTC"` so server and
 * client agree, /status wants a time and a zone name — and every one of those
 * is a legitimate choice. `localeDateTag(locale)` hands them the tag and
 * leaves the options alone.
 *
 * `toLocaleString` on a NUMBER is out of scope. `lib/preferences/formatters.ts`
 * pins `en-US` for figures on purpose (ADR-0007: Western digits in both
 * locales) and `unit-labels.ts` restates it, so a number tag is a decision
 * this rule would be second-guessing. The pattern therefore requires a
 * date-style method name.
 *
 * ## Shape
 *
 * Modelled on G-5 (`lib/rtl/no-physical-utilities.test.ts`) and G-14, this
 * repo's proven pattern: vitest over `git ls-files`, comments stripped,
 * allowlist that may only shrink.
 */
const REPO_ROOT = join(import.meta.dirname, "..", "..");

/**
 * A hardcoded tag in a call that formats a DATE.
 *
 * Two alternatives, because the method name is only sometimes enough:
 *
 * - `toLocaleDateString` / `toLocaleTimeString` exist only on `Date`, so a
 *   literal tag there is always an offender.
 * - `toLocaleString` is on `Date` **and** on `Number`, and the number case is
 *   deliberate — `lib/preferences/formatters.ts` pins `en-US` for figures by
 *   decision (ADR-0007: Western digits in both locales) and four public
 *   surfaces follow it. A regex cannot see the receiver's type, so the date
 *   case is identified by its options bag instead: a call carrying `day`,
 *   `month`, `weekday`, `hour` and friends is formatting a date whatever it
 *   is called. `Intl.NumberFormat` has no such option, so there is nothing for
 *   this to catch by accident.
 *
 * Both anchor on a quote right after the paren, so a call already passing a
 * variable — `toLocaleDateString(localeDateTag(locale), …)` — does not match.
 * `\s*` throughout and a whole-file (not per-line) scan because prettier
 * breaks long calls across lines, and an offender must not be able to hide
 * behind formatting.
 */
const TAG = String.raw`["'][a-z]{2}(?:-[A-Za-z0-9]+)*["']`;
const DATE_OPTION = String.raw`\b(?:weekday|era|year|month|day|hour|minute|second|timeZone|dateStyle|timeStyle)\b`;
const HARDCODED_TAG = new RegExp(
  String.raw`\.toLocale(?:Date|Time)String\(\s*${TAG}` +
    "|" +
    String.raw`\.toLocaleString\(\s*${TAG}\s*,\s*\{[^}]*${DATE_OPTION}`,
  "g",
);

/**
 * **Shrink only.** Not a backlog — every public offender this rule found was
 * converted rather than recorded, so an entry here has to justify itself as
 * English *by decision*.
 *
 * `live-dot.tsx` is the one: it lives under `lib/` and so is scanned, but its
 * only three call sites are `(admin)` pages, and the CMS is permanently
 * English (ADR-0007 §6). Its `toLocaleTimeString` prints a probe timestamp in
 * a `title` attribute for staff. Threading a locale into it would be churn
 * with no reader on the other end — but it is worth naming here rather than
 * silently globbing out, because the day a `LiveDot` appears on a public page
 * the staleness check below is what will make someone look at it again.
 */
const ALLOWED: readonly string[] = ["lib/realtime/live-dot.tsx"];

/** What the allowlist held when the rule landed. It may not grow. */
const ALLOWED_CEILING = 1;

/**
 * Strip comments so a docblock quoting the idiom is not a violation.
 *
 * A block comment is replaced by its OWN newlines rather than by nothing, so
 * the stripped source keeps the line numbering of the original. G-14 collapses
 * them; it gets away with it because its allowlist is keyed by file and it
 * never has to point at a line. This guard reports `file:line` for a human to
 * open, and a docblock earlier in the file would otherwise shift every number
 * under it — during development this pointed at `label: string;` in a file
 * whose real offender was 40 lines further down.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/^\s*\/\/.*$/gm, "");
}

/** 1-indexed line of a character offset in `source`. */
function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source[i] === "\n") line++;
  return line;
}

function scannedFiles(): string[] {
  return (
    execFileSync(
      "git",
      [
        "ls-files",
        /*
         * ESCAPED brackets, and load-bearing — in a git pathspec `[locale]` is
         * a character class over l/o/c/a/e, so the unescaped form matches the
         * directory zero times and the guard passes vacuously over the whole
         * public tree. G-14's header records this being found by mutation
         * testing rather than by reading; the file-count assertion below is
         * the standing version of that check.
         */
        "app/\\[locale\\]/(public)/**/*.ts",
        "app/\\[locale\\]/(public)/**/*.tsx",
        "components/brand/**/*.tsx",
        "components/ui/**/*.tsx",
        "lib/**/*.ts",
        "lib/**/*.tsx",
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .filter((f) => !/\.test\.tsx?$/.test(f))
      /*
       * Both English by decision, not by omission:
       *   - PDFs stay English (docs/I18N.md), so a pinned tag is correct.
       *   - `lib/i18n/dates.ts` is where the tags are DEFINED. Excluding it is
       *     not a waiver; it is the one file the rule is pointing at.
       */
      .filter((f) => !f.startsWith("lib/pdf/"))
      .filter((f) => f !== "lib/i18n/dates.ts")
  );
}

describe("G-19 · no hardcoded locale tags in date formatting", () => {
  it("finds none outside the allowlist", () => {
    const offenders: string[] = [];

    for (const file of scannedFiles()) {
      if (ALLOWED.includes(file)) continue;
      const src = stripComments(readFileSync(join(REPO_ROOT, file), "utf8"));
      for (const m of src.matchAll(HARDCODED_TAG)) {
        offenders.push(`${file}:${lineAt(src, m.index)}`);
      }
    }

    expect(
      offenders,
      `A date formatted with a hardcoded locale tag:\n${offenders.join("\n")}\n\n` +
        `On /ar this renders an English date under translated copy — the one ` +
        `fragment a reviewer who does not read Arabic will never notice.\n\n` +
        `Take the tag from the locale and keep your own options:\n` +
        `  import { localeDateTag } from "@/lib/i18n/dates";\n` +
        `  d.toLocaleDateString(localeDateTag(locale), { day: "numeric", … })\n\n` +
        `or, for an editorial byline, use formatPublishedDate(iso, locale).\n` +
        `Get \`locale\` from \`params\` — never an ambient getLocale(), which ` +
        `reaches for headers() and drops the route out of prerendering.\n\n` +
        `Do NOT add the file to ALLOWED unless the surface is English by ` +
        `DECISION — an admin screen or a PDF. A public page is not.`,
    ).toEqual([]);
  });

  it("only ever lets the allowlist shrink", () => {
    expect(ALLOWED.length).toBeLessThanOrEqual(ALLOWED_CEILING);
    expect(new Set(ALLOWED).size).toBe(ALLOWED.length);
  });

  /**
   * An entry that no longer contains the idiom is a conversion that finished;
   * leaving it behind lets the next offender in that file through unseen.
   */
  it("keeps the allowlist honest", () => {
    const stale = ALLOWED.filter((file) => {
      const src = stripComments(readFileSync(join(REPO_ROOT, file), "utf8"));
      return src.match(HARDCODED_TAG) === null;
    });
    expect(
      stale,
      `These files no longer hardcode a tag — remove them from ALLOWED and ` +
        `lower ALLOWED_CEILING:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * The guard that stops the guard passing vacuously. An unescaped pathspec,
   * a renamed directory or a typo'd glob all present as "no offenders found",
   * which is indistinguishable from success.
   */
  it("actually scans the tree", () => {
    const files = scannedFiles();
    expect(files.length).toBeGreaterThan(200);
    expect(files).toContain("app/[locale]/(public)/press/page.tsx");
    expect(files).toContain("app/[locale]/(public)/p/[slug]/page.tsx");
  });

  /** And the guard that stops the pattern silently ceasing to match. */
  it("still catches the shape it was written for", () => {
    const hits = (s: string) => s.match(HARDCODED_TAG) !== null;

    const planted = [
      `new Date(iso).toLocaleDateString("en-GB", { day: "numeric" })`,
      `d.toLocaleTimeString("en-GB")`,
      `d.toLocaleDateString( "en" )`,
      // Bare toLocaleString on a Date, identified by its options.
      `d.toLocaleString('ar-AE', { hour: "2-digit" })`,
      // Prettier-wrapped, which a per-line scan would have missed.
      `d.toLocaleDateString(\n  "en-GB",\n  { day: "numeric" },\n)`,
    ];
    for (const s of planted) expect(hits(s), s).toBe(true);

    const fine = [
      `d.toLocaleDateString(localeDateTag(locale), { day: "numeric" })`,
      `d.toLocaleDateString(tag, opts)`,
      `formatPublishedDate(iso, locale)`,
      // Numbers, which pin their tag deliberately — see the header.
      `n.toLocaleString("en-US")`,
      `n.toLocaleString("en-US", { maximumFractionDigits: 0 })`,
    ];
    for (const s of fine) expect(hits(s), s).toBe(false);
  });
});
