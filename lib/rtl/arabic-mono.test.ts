/**
 * @vitest-environment node
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Arabic inside mono text (client, Oct 2026: "the old font").
 *
 * JetBrains Mono has no Arabic glyphs. Two things kept Arabic words in mono
 * text on /ar — "درهم" in a price, "المرجع", a month name — from looking like
 * the rest of the page:
 *
 *  1. The face. With the Latin mono stack, Arabic letters fell through to
 *     next/font's Arial-based fallback. The `:lang(ar)` stack now
 *     puts the site's Arabic body face right behind JetBrains Mono. The first
 *     test keeps it there: it is the one line that covers every page,
 *     including ones not written yet.
 *  2. The direction. `.mono` is LTR under `:lang(ar)` (so a reference code
 *     reads `BAZ-AD-09790`), which puts the currency or month on the wrong
 *     side of its number. Text that carries Arabic words takes `.mono-en`
 *     instead: mono in English, the Arabic face in the page's direction on
 *     /ar. The second test flags a `.mono` element whose content comes from a
 *     translation or a locale-aware formatter, the way those words get in.
 *
 * The audit behind this walked every Arabic text node on ~35 /ar page types and
 * read its computed font and direction; every offender was one of these two.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CSS = readFileSync(join(REPO_ROOT, "app/globals.css"), "utf8");

function publicTsx(): string[] {
  return execSync("git ls-files 'app/*.tsx' 'components/*.tsx'", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((f) => !/\(admin\)|\/admin\/|\.test\.|global-error|components\/ui\//.test(f));
}

/**
 * `.mono` elements whose content is Latin even on /ar — a reference, a permit
 * number, a percentage, a multiplier, an OTP — or that pin English on purpose.
 * Keyed `file:line`-free (by the line's text) so unrelated edits don't churn it.
 */
const LATIN_ON_PURPOSE: { file: string; contains: string; why: string }[] = [
  { file: "investment-metrics.tsx", contains: "{r.ref}", why: "listing reference" },
  { file: "investment-metrics.tsx", contains: 'className="mono text-bz-ink">', why: "a percentage" },
  { file: "valuation-wizard.tsx", contains: '<span className="mono">', why: "AED/ft² rate and × multipliers" },
  { file: "lead-gate.tsx", contains: "bg-bz-surface-2 p-2 mono", why: "the email address the code went to" },
  { file: "hero-variants.tsx", contains: "AED 6–9M", why: "sample budget, English-only variant" },
  { file: "specification.tsx", contains: "{permitNo}", why: "permit number" },
  { file: "received.tsx", contains: "{s.reference}", why: "request reference" },
  { file: "location-section.tsx", contains: "{c.minutes}m", why: "minutes figure" },
];

const MONO = /className=\{?[`"][^`"]*(?<![\w-])mono(?![\w-])[^`"]*[`"]/;
const LOCALISED = /\bt\(|formatPrice|formatMoney|formatCompact|formatDate|formatPublished|toLocaleDateString|formatArea|AreaText|PriceText|labels\.currency|copy\./;

describe("Arabic in mono text", () => {
  it("draws Arabic letters in mono text with the site's Arabic face", () => {
    const start = CSS.indexOf(":lang(ar) {\n  --bz-font-sans:");
    expect(start, "the :lang(ar) token block").toBeGreaterThan(-1);
    const block = CSS.slice(start, CSS.indexOf("\n}\n", start));
    // JetBrains Mono by name, then the Arabic face. Not `--font-jetbrains-mono`:
    // next/font appends a `local("Arial")` fallback to it, and Arial's Arabic
    // glyphs would win over the site's face.
    expect(block).toMatch(/--bz-font-mono:\s*"JetBrains Mono",\s*var\(--bz-font-ar-body\)/);
  });

  it("keeps translated or locale-formatted text out of .mono (use .mono-en)", () => {
    const offenders: string[] = [];
    for (const file of publicTsx()) {
      const lines = readFileSync(join(REPO_ROOT, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!MONO.test(line)) return;
        const window = lines.slice(i, i + 5).join("\n");
        if (!LOCALISED.test(window)) return;
        const allowed = LATIN_ON_PURPOSE.some(
          (a) => file.endsWith(a.file) && window.includes(a.contains),
        );
        if (!allowed) offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 80)}`);
      });
    }
    expect(
      offenders,
      "Arabic words in `.mono` render left-to-right on /ar. Use `.mono-en`, or add the line to LATIN_ON_PURPOSE with the reason it stays Latin:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
