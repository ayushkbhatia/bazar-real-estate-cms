/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * G-13 — no un-extracted user-facing literal.
 *
 * The mechanism that makes "extract every public string" a claim you can
 * check rather than a claim you make. Modelled on G-5
 * (`lib/rtl/no-physical-utilities.test.ts`) and G-14
 * (`lib/i18n/no-hand-rolled-plurals.test.ts`): a vitest file over
 * `git ls-files` with an allowlist that may only shrink.
 *
 * ## Why a count per file and not just a file list
 *
 * A bare list answers "is this file done". A count answers "how much of it",
 * and that is the question the waves kept getting wrong. W5 was planned at
 * ~740 strings on the assumption that guides, services, about and contact
 * were all editorial copy; guides were (405 keys) and the rest turned out to
 * be master-page-driven, where the literals are ADR-0007's designed English
 * fallback and extracting them would create a second writable copy of a CMS
 * string. The estimate was wrong by roughly 300 in one direction and by a
 * whole architectural category in the other.
 *
 * It also catches the failure a file list cannot see: extracting three
 * strings out of nine and moving on. That is not hypothetical — this guard's
 * first run found leftovers in `p/[slug]/page.tsx` and `filter-bar.tsx`,
 * both of which their waves reported finished.
 *
 * ## What it looks for
 *
 * Three places a literal reaches the screen: a JSX text node, one of the
 * props that renders as words (`label`, `placeholder`, `aria-label`, `title`,
 * `alt`, `heading`, `cta`, `eyebrow`), and a `toast.*` call.
 *
 * Deliberately not "every string in the file". `className`, `href`, `id`,
 * `data-testid`, an enum member and an import path are all identity, and a
 * detector that flagged them would be noise a contributor learns to route
 * around. The cost of that choice is honest: this is a FLOOR. A string
 * interpolated through a variable, or built by a helper, is invisible to it.
 *
 * ## What is out of scope, and why each one
 *
 *  - **Unreferenced modules** (`lib/dead-code.test.ts`) — they render nowhere,
 *    so their strings would be extracted, translated, human-reviewed and then
 *    shown to nobody. Seventeen such components were deleted in waves 4b/4c.
 *  - **`/legal/*`** — the privacy policy's Arabic is the client's own,
 *    reconstructed from their PDF by glyph position; terms and cookies need
 *    the client the same way. A client dependency, not a task.
 *  - **`?? "default"` fallbacks** — excluded by construction rather than by
 *    rule: a fallback lives inside `{…}`, so it matches neither the JSX-text
 *    nor the bare-prop pattern. That is the right outcome. They are the
 *    fallback ADR-0007 §5 designs, and `lib/master-pages/**` is off-limits to
 *    the waves precisely so extraction cannot fork a CMS string.
 *  - **`app/(admin)`, `lib/pdf/**`** — English by decision (ADR-0007 §6).
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/**
 * Files that still hold literals, and how many each holds.
 *
 * **Shrink only.** A wave lowers a number or deletes a line; nothing may be
 * added, and no number may go up. Reaching empty is what "the public surface
 * is extracted" means.
 */
const REMAINING: Readonly<Record<string, number>> = {
  "app/[locale]/(public)/_components/area-map/area-chips.tsx": 1,
  "app/[locale]/(public)/_components/area-map/area-map-home.tsx": 1,
  "app/[locale]/(public)/_components/area-map/area-map.tsx": 6,
  "app/[locale]/(public)/_components/commute-time-tool.tsx": 3,
  "app/[locale]/(public)/_components/curated-grid.tsx": 1,
  "app/[locale]/(public)/_components/developer-marquee.tsx": 1,
  "app/[locale]/(public)/_components/developers-section.tsx": 3,
  "app/[locale]/(public)/_components/draw-area-tool.tsx": 2,
  "app/[locale]/(public)/_components/dual-range-slider.tsx": 2,
  "app/[locale]/(public)/_components/filter-bar.tsx": 4,
  "app/[locale]/(public)/_components/footer-trust.tsx": 1,
  "app/[locale]/(public)/_components/forms/form-renderer.tsx": 2,
  "app/[locale]/(public)/_components/hero-search.tsx": 6,
  "app/[locale]/(public)/_components/home/home-faqs.tsx": 1,
  "app/[locale]/(public)/_components/home/home-testimonials.tsx": 3,
  "app/[locale]/(public)/_components/home/list-your-property.tsx": 1,
  "app/[locale]/(public)/_components/home/location-browsing.tsx": 2,
  "app/[locale]/(public)/_components/home/mortgage-calculator-section.tsx": 9,
  "app/[locale]/(public)/_components/home/off-plan-projects.tsx": 4,
  "app/[locale]/(public)/_components/home/who-we-are.tsx": 4,
  "app/[locale]/(public)/_components/market-context-link.tsx": 3,
  "app/[locale]/(public)/_components/marketing/buy-category-explorer.tsx": 2,
  "app/[locale]/(public)/_components/marketing/buy-properties-map.tsx": 3,
  "app/[locale]/(public)/_components/marketing/buy-rent-landing.tsx": 2,
  "app/[locale]/(public)/_components/marketing/featured-listings.tsx": 1,
  "app/[locale]/(public)/_components/marketing/lead-band.tsx": 1,
  "app/[locale]/(public)/_components/marketing/rent-area-map.tsx": 2,
  "app/[locale]/(public)/_components/marketing/why-band.tsx": 1,
  "app/[locale]/(public)/_components/mode-segmented.tsx": 1,
  "app/[locale]/(public)/_components/more-filters-drawer.tsx": 8,
  "app/[locale]/(public)/_components/off-plan/offplan-map-explorer.tsx": 3,
  "app/[locale]/(public)/_components/off-plan/project-interest-form.tsx": 2,
  "app/[locale]/(public)/_components/pagination.tsx": 3,
  "app/[locale]/(public)/_components/partner-ecosystem-section.tsx": 3,
  "app/[locale]/(public)/_components/partner-marquee.tsx": 1,
  "app/[locale]/(public)/_components/preferences-controls.tsx": 2,
  "app/[locale]/(public)/_components/search-list.tsx": 1,
  "app/[locale]/(public)/_components/shortlist-drawer.tsx": 7,
  "app/[locale]/(public)/_components/trust-strip.tsx": 2,
  "app/[locale]/(public)/about/page.tsx": 1,
  "app/[locale]/(public)/agents/[slug]/page.tsx": 8,
  "app/[locale]/(public)/agents/page.tsx": 2,
  "app/[locale]/(public)/areas/[slug]/_components/lifestyle-dossier.tsx": 3,
  "app/[locale]/(public)/areas/[slug]/opengraph-image.tsx": 3,
  "app/[locale]/(public)/areas/[slug]/page.tsx": 4,
  "app/[locale]/(public)/areas/_components/area-spotlights.tsx": 2,
  "app/[locale]/(public)/areas/_components/community-types.tsx": 2,
  "app/[locale]/(public)/concierge/page.tsx": 2,
  "app/[locale]/(public)/contact-qr/_components/contact-card.tsx": 1,
  "app/[locale]/(public)/contact/_components/hq-map.tsx": 3,
  "app/[locale]/(public)/data-deleted/page.tsx": 4,
  "app/[locale]/(public)/developers/[slug]/page.tsx": 4,
  "app/[locale]/(public)/developments/[slug]/_components/brochure-gate.tsx": 2,
  "app/[locale]/(public)/developments/[slug]/_components/floor-plan-lightbox.tsx": 4,
  "app/[locale]/(public)/developments/[slug]/_components/floorplan-gate.tsx": 8,
  "app/[locale]/(public)/developments/[slug]/_components/lead-advisor-banner.tsx": 1,
  "app/[locale]/(public)/developments/[slug]/_components/unit-floor-plans.tsx": 1,
  "app/[locale]/(public)/developments/[slug]/_payment-plan.tsx": 4,
  "app/[locale]/(public)/developments/[slug]/page.tsx": 6,
  "app/[locale]/(public)/developments/page.tsx": 6,
  "app/[locale]/(public)/exclusive/page.tsx": 2,
  "app/[locale]/(public)/forgot-password/_form.tsx": 4,
  "app/[locale]/(public)/insights/[slug]/opengraph-image.tsx": 1,
  "app/[locale]/(public)/insights/[slug]/page.tsx": 4,
  "app/[locale]/(public)/insights/author/[slug]/page.tsx": 3,
  "app/[locale]/(public)/insights/category/[cat]/page.tsx": 2,
  "app/[locale]/(public)/market-reports/[area]/[type]/[quarter]/page.tsx": 4,
  "app/[locale]/(public)/market-reports/_components/comparables-table.tsx": 4,
  "app/[locale]/(public)/market-reports/_components/live-listings-rail.tsx": 1,
  "app/[locale]/(public)/market-reports/_components/report-download.tsx": 1,
  "app/[locale]/(public)/market-reports/_components/report-hero.tsx": 4,
  "app/[locale]/(public)/market-reports/_components/trend-chart.tsx": 1,
  "app/[locale]/(public)/market-reports/_components/velocity-strip.tsx": 1,
  "app/[locale]/(public)/market-reports/page.tsx": 2,
  "app/[locale]/(public)/new-this-week/page.tsx": 2,
  "app/[locale]/(public)/p/[slug]/_components/action-row.tsx": 3,
  "app/[locale]/(public)/p/[slug]/_components/advisor-note.tsx": 1,
  "app/[locale]/(public)/p/[slug]/_components/agent-card.tsx": 3,
  "app/[locale]/(public)/p/[slug]/_components/enquiry-dialog.tsx": 1,
  "app/[locale]/(public)/p/[slug]/_components/floor-plan-section.tsx": 5,
  "app/[locale]/(public)/p/[slug]/_components/floor-plan-viewer.tsx": 3,
  "app/[locale]/(public)/p/[slug]/_components/gallery-tabs.tsx": 3,
  "app/[locale]/(public)/p/[slug]/_components/gallery.tsx": 1,
  "app/[locale]/(public)/p/[slug]/_components/property-faq.tsx": 1,
  "app/[locale]/(public)/p/[slug]/_components/specification.tsx": 3,
  "app/[locale]/(public)/p/[slug]/opengraph-image.tsx": 3,
  "app/[locale]/(public)/p/[slug]/page.tsx": 9,
  "app/[locale]/(public)/partners/page.tsx": 6,
  "app/[locale]/(public)/press/page.tsx": 2,
  "app/[locale]/(public)/price-drops/page.tsx": 2,
  "app/[locale]/(public)/qr/page.tsx": 1,
  "app/[locale]/(public)/services/_components/service-card.tsx": 1,
  "app/[locale]/(public)/services/sell/_components/list-property-form.tsx": 3,
  "app/[locale]/(public)/sitemap/page.tsx": 2,
  "app/[locale]/(public)/status/page.tsx": 9,
};

/** What the ratchet held when it landed. Lowering it is the point. */
const TOTAL_CEILING = 275;

/**
 * Three shapes, matching the three ways a literal reaches a reader.
 *
 * Each requires an initial capital: a lowercase run inside a tag is far more
 * often a fragment of an expression than a sentence, and the false positives
 * cost more than the misses.
 */
const PATTERNS: readonly RegExp[] = [
  /*
   * A JSX text node: `>Book a viewing<`.
   *
   * `[A-Z][^<>{}\n]` and not `[A-Z][A-Za-z]`: the stricter version required
   * two leading letters, so every sentence opening on a one-letter word — "A
   * senior advisor will…", "I agree that…" — was invisible. Found by mutation
   * testing this file rather than by reading it: a planted "A planted
   * sentence that nobody extracted." went undetected.
   */
  />\s*([A-Z][^<>{}\n]{4,})\s*</g,
  // A prop that renders as words. `className` and `href` are absent on purpose.
  /\b(?:label|placeholder|aria-label|title|alt|heading|cta|eyebrow)\s*=\s*"([A-Z][^"]{3,})"/g,
  /toast\.\w+\(\s*"([A-Z][^"]{3,})"/g,
];

/** Strip comments so a docblock quoting copy is not a violation. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The modules `lib/dead-code.test.ts` records as imported by nothing. */
function unreferenced(): Set<string> {
  const src = readFileSync(join(REPO_ROOT, "lib/dead-code.test.ts"), "utf8");
  const block = /const UNREFERENCED[\s\S]*?\n};/.exec(src)?.[0] ?? "";
  return new Set([...block.matchAll(/"([^"]+\.tsx?)":/g)].map((m) => m[1]!));
}

function scannedFiles(): string[] {
  const skip = unreferenced();
  return execFileSync(
    "git",
    [
      "ls-files",
      // Escaped, and load-bearing: in a git pathspec `[locale]` is a character
      // class matching one of l/o/c/a/e, so the unescaped form matches the
      // directory zero times and the whole guard passes vacuously. G-14 shipped
      // with exactly that bug and scanned nothing under app/ for a wave.
      "app/\\[locale\\]/(public)/**/*.tsx",
      "components/brand/**/*.tsx",
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .filter((f) => !/\.test\.tsx?$/.test(f))
    // `git ls-files` reads the index, so a file deleted but not yet staged is
    // still listed. Without this the guard throws ENOENT mid-refactor.
    .filter((f) => existsSync(join(REPO_ROOT, f)))
    .filter((f) => !skip.has(f))
    // The client's own Arabic, and two documents that need them the same way.
    .filter((f) => !f.includes("/legal/"));
}

/** Distinct user-facing literals in one file. */
function literalsIn(file: string): string[] {
  const src = stripComments(readFileSync(join(REPO_ROOT, file), "utf8"));
  const found = new Set<string>();
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of src.matchAll(pattern)) {
      const value = match[1]!.trim();
      // A SCREAMING_CASE token is an identity, not a sentence.
      if (/^[A-Z][A-Z0-9_]*$/.test(value)) continue;
      // A short single word is far more often a component or a variable.
      if (/^\w+$/.test(value) && value.length < 5) continue;
      // Words, not a run of punctuation or digits that happens to start
      // with a capital — the widened pattern above lets those through.
      if (!/[a-z]{2}/.test(value)) continue;
      found.add(value);
    }
  }
  return [...found];
}

function counts(): Map<string, number> {
  const out = new Map<string, number>();
  for (const file of scannedFiles()) {
    const n = literalsIn(file).length;
    if (n > 0) out.set(file, n);
  }
  return out;
}

describe("G-13 · no un-extracted user-facing literal", () => {
  it("finds none in a file the allowlist says is finished", () => {
    const now = counts();
    const surprises = [...now]
      .filter(([file]) => !(file in REMAINING))
      .map(([file, n]) => `${file} (${n})`);

    expect(
      surprises.sort(),
      `These files hold user-facing literals and are not on the ratchet:\n` +
        `${surprises.sort().join("\n")}\n\n` +
        `Extract them into messages/ — or, if they are genuinely not copy ` +
        `(an identity, an enum member, a fallback for CMS content), leave ` +
        `them and say why in a comment. Do NOT add a line to REMAINING: that ` +
        `list is closed.`,
    ).toEqual([]);
  });

  it("never lets a file's count go up", () => {
    const now = counts();
    const grown: string[] = [];
    for (const [file, allowed] of Object.entries(REMAINING)) {
      const actual = now.get(file) ?? 0;
      if (actual > allowed) grown.push(`${file}: ${allowed} -> ${actual}`);
    }
    expect(
      grown.sort(),
      `These files gained literals:\n${grown.sort().join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the ratchet honest", () => {
    // A file that is now clean, or cleaner, and still claims its old number.
    // Harmless, but it hides progress and makes the ceiling mean less.
    const now = counts();
    const stale: string[] = [];
    for (const [file, allowed] of Object.entries(REMAINING)) {
      const actual = now.get(file) ?? 0;
      if (actual < allowed) stale.push(`${file}: ${allowed} -> ${actual}`);
    }
    expect(
      stale.sort(),
      `These files hold fewer literals than the ratchet claims — lower the ` +
        `number, or remove the line if it is 0, and lower ` +
        `TOTAL_CEILING:\n${stale.sort().join("\n")}`,
    ).toEqual([]);
  });

  it("only ever lets the total shrink", () => {
    expect(
      Object.values(REMAINING).reduce((a, b) => a + b, 0),
    ).toBeLessThanOrEqual(TOTAL_CEILING);
  });

  it("scans a believable number of files", () => {
    // The assertion that stops a broken pathspec from making every check
    // above vacuously true.
    expect(scannedFiles().length).toBeGreaterThan(200);
  });
});
