import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * G-5 — the lockfile. No physical direction utility anywhere in the tree.
 *
 * The whole codebase was converted from physical to logical utilities in one
 * pass (`ml-` → `ms-`, `pr-` → `pe-`, `text-left` → `text-start`, …). That
 * conversion is only worth anything if it stays converted: one `mr-2` added by
 * hand next month is a component that silently renders backwards in Arabic,
 * and nobody reading the English site will ever see it.
 *
 * This covers `components/brand` and `components/ui` too. Those are normally
 * off-limits shared files; the direction conversion was explicitly waived, and
 * this test is the other half of that waiver — the reason it was safe to edit
 * them is that they cannot drift back.
 *
 * Three things are deliberately NOT failures, because a physical value is
 * correct in each:
 *   - `left-1/2` paired with `-translate-x-1/2` — centring, not direction.
 *     `start-1/2` would flip to right:50% while the translate did not.
 *   - anything inside a `data-[side=left|right]:` chain — Radix's `data-side`
 *     is physical placement, so a physical utility keyed off it already agrees.
 *   - `inset-x-*` — symmetric by construction.
 */
const REPO_ROOT = path.join(__dirname, "..", "..");

const SEARCH_GLOBS = [
  "app/**/*.tsx",
  "app/**/*.ts",
  "components/**/*.tsx",
  "lib/**/*.tsx",
];

/** Physical utilities with a logical equivalent that should have been used. */
const PHYSICAL = String.raw`-?(ml|mr|pl|pr)-[\w./\[\]%-]+|-?(left|right)-[\w./\[\]%-]+|text-(left|right)\b|float-(left|right)\b|border-(l|r)(-[\w.]+)?\b|rounded-(l|r|tl|tr|bl|br)(-[\w.]+)?\b|scroll-(ml|mr)-[\w./-]+`;

/**
 * Class-position only: the utility must be preceded by a quote, backtick,
 * space or a variant colon. Without this anchor, ten English phrases in this
 * repo match — "right-rail", "right-to-left", "right-hand", "right-column-title",
 * "left-rule" — and the guard cries wolf on prose.
 */
const TOKEN = new RegExp(String.raw`(^|["'\` ])((?:[\w[\]=^~*.$/-]+:)*)(${PHYSICAL})(?=["'\` ]|$)`, "g");

function sourceFiles(): string[] {
  return execFileSync("git", ["ls-files", ...SEARCH_GLOBS], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
}

/** Strip comments so a docblock mentioning `mr-2` is not a violation. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function violations(): string[] {
  const out: string[] = [];

  for (const file of sourceFiles()) {
    const src = stripComments(readFileSync(path.join(REPO_ROOT, file), "utf8"));
    const lines = src.split("\n");

    lines.forEach((line, i) => {
      // A centring pair on the same element is deliberate.
      if (/-translate-x-1\/2/.test(line) && /(left|right)-1\/2/.test(line)) return;

      for (const m of line.matchAll(TOKEN)) {
        const variants = m[2] ?? "";
        // Radix data-side is physical placement — already correct both ways.
        if (/data-\[side=(left|right)\]/.test(variants)) continue;
        out.push(`${file}:${i + 1}  ${m[3]}`);
      }
    });
  }
  return out;
}

describe("logical direction utilities", () => {
  it("finds source files to check, so the guard is not vacuous", () => {
    expect(sourceFiles().length).toBeGreaterThan(400);
  });

  it("has no physical direction utility left anywhere", () => {
    const found = violations();
    expect(
      found,
      `Physical direction utilities render backwards in Arabic and look fine in ` +
        `English, so nothing else will catch these. Use the logical form ` +
        `(ms-/me-, ps-/pe-, start-/end-, text-start/text-end, border-s/border-e, ` +
        `rounded-s/rounded-e):\n${found.join("\n")}`,
    ).toEqual([]);
  });
});
