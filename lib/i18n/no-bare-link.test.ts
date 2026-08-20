import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The lockfile for locale-aware links. No public file imports `next/link`.
 *
 * ## What this is protecting
 *
 * The locale is in the URL, so an href that omits it is an href back to
 * English. Every internal link in this repo was written that way — correct
 * while `LOCALES` was `["en"]`, and a silent bug the day it grew. Measured on
 * `/ar/buy`: 46 of 56 internal links pointed home to English, so a visitor who
 * switched language was switched back by their next click.
 *
 * 97 files were swapped to `@/components/i18n/link` in one pass. That is worth
 * nothing if the 98th `import Link from "next/link"` lands next sprint — and
 * nobody reviewing the English site would ever see the difference, because for
 * the default locale the wrapper is the identity function. This is the test
 * that makes the swap stay swapped.
 *
 * ## Why the CMS is exempt
 *
 * `/admin` is English-only, permanently (ADR-0007), and the proxy redirects
 * `/ar/admin` back out. There is no locale for the wrapper to add there, so
 * requiring it would be ceremony rather than a guard — and it would put a
 * `usePathname()` call into ~73 files that have no use for one.
 *
 * ## Why plain `<a href="/…">` is not covered here
 *
 * It cannot be: an anchor is also the right way to write a `mailto:`, a `tel:`,
 * a same-page `#anchor`, and the language switch itself, and a regex cannot
 * tell those from an internal path reliably enough to gate a build. That gap
 * is covered at runtime instead — `proxy.ts` redirects an unprefixed URL to
 * the visitor's chosen locale, which catches a stray `<a>`, a `router.push`,
 * a `redirect()` out of a Server Action, and a shared link, all of which this
 * test would miss.
 */
const REPO_ROOT = path.join(__dirname, "..", "..");

/**
 * Where a locale-aware link is required. The public marketplace, the shared
 * chrome that renders inside it, and the two root-level pages a visitor can
 * reach from either side.
 *
 * Plain prefixes, matched in JS, rather than a `git ls-files` pathspec. The
 * route group is literally named `[locale]`, and to a pathspec `[locale]` is a
 * character class matching one of `l o c a e` — so the obvious glob quietly
 * matches 15 files instead of 100 and the guard passes by checking almost
 * nothing. Which is the failure mode the first assertion below exists to
 * catch.
 */
const SEARCH_PREFIXES = [
  "app/[locale]/(public)/",
  "app/[locale]/error.tsx",
  "app/[locale]/not-found.tsx",
  "app/_consent/",
  "components/brand/",
];

const BARE_IMPORT = /^import\s+.*\bfrom\s+["']next\/link["']/m;

function sourceFiles(): string[] {
  return execFileSync("git", ["ls-files", "--", "app", "components"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .filter((f) => SEARCH_PREFIXES.some((prefix) => f.startsWith(prefix)))
    // `git ls-files` reads the index, which still lists a file deleted from the
    // working tree until the deletion is staged.
    .filter((f) => existsSync(path.join(REPO_ROOT, f)));
}

describe("no bare next/link on the public site", () => {
  it("has files to check", () => {
    // A glob that stops matching would make this suite pass by covering
    // nothing, which is the failure mode of every filesystem-walking guard.
    expect(sourceFiles().length).toBeGreaterThan(80);
  });

  it("routes every public link through the locale-aware wrapper", () => {
    const offenders = sourceFiles().filter((f) =>
      BARE_IMPORT.test(readFileSync(path.join(REPO_ROOT, f), "utf8")),
    );

    expect(
      offenders,
      `These import next/link directly, so their hrefs drop an Arabic visitor ` +
        `back into English:\n  ${offenders.join("\n  ")}\n` +
        `Use \`import Link from "@/components/i18n/link"\` instead.`,
    ).toEqual([]);
  });
});
