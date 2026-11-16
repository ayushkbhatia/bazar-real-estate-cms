import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every indexable public route publishes `localeAlternates(path, locale)`.
 *
 * ## What this is protecting
 *
 * Until Nov 2026, about forty routes wrote `alternates: { canonical: "/buy" }`.
 * A path with no locale resolves against `metadataBase`, so every `/ar/...`
 * page told search engines "I am a copy of the English page", and no page
 * emitted an HTML hreflang, only the sitemap did. Google treats a canonical
 * as a strong hint, so the Arabic site was being folded into the English one.
 * Another twenty-five routes had no canonical at all.
 *
 * Each of those was correct for English and wrong for Arabic, and nobody
 * reviewing the English site would see the difference. So the guard is
 * static: a literal canonical anywhere under the public routes fails, and so
 * does a page that does not call `localeAlternates`, unless it is listed
 * below with its reason.
 */
const ROOT = path.join(__dirname, "..", "..", "app", "[locale]", "(public)");

/** Routes with no canonical on purpose. Keep each reason honest. */
const EXEMPT: Record<string, string> = {
  "legal/page.tsx": "redirects to /legal/privacy",
  "off-plan/[slug]/page.tsx":
    "re-exports generateMetadata from developments/[slug], which canonicalises to /developments/<slug>",
  "forgot-password/page.tsx": "noindex utility page",
  "data-deleted/page.tsx": "noindex utility page",
  "newsletter/confirm/[token]/page.tsx": "noindex token page",
  "newsletter/unsubscribe/[token]/page.tsx": "noindex token page",
  // Filtered result pages: a canonical decides which filter combinations are
  // indexable, which is its own decision, not part of the locale fix.
  "buy/search/page.tsx": "search results; filter canonicalisation not decided",
  "rent/search/page.tsx": "search results; filter canonicalisation not decided",
  "off-plan/search/page.tsx": "search results; filter canonicalisation not decided",
};

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

const files = pages(ROOT).map((f) => ({
  rel: path.relative(ROOT, f).split(path.sep).join("/"),
  src: readFileSync(f, "utf8"),
}));

describe("locale canonicals", () => {
  it("finds the public routes (a broken walk would pass vacuously)", () => {
    expect(files.length).toBeGreaterThan(70);
  });

  it("no public route writes a canonical by hand", () => {
    const literal = files
      .filter((f) => /\bcanonical\s*:/.test(f.src))
      .map((f) => f.rel);
    expect(literal).toEqual([]);
  });

  it("every indexable public route calls localeAlternates", () => {
    const missing = files
      .filter((f) => !(f.rel in EXEMPT))
      .filter((f) => !/\blocaleAlternates\(/.test(f.src))
      .map((f) => f.rel);
    expect(missing).toEqual([]);
  });

  it("every exemption still exists and still has no alternates", () => {
    const byRel = new Map(files.map((f) => [f.rel, f.src]));
    for (const rel of Object.keys(EXEMPT)) {
      expect(byRel.has(rel), `${rel} no longer exists`).toBe(true);
      expect(
        /\blocaleAlternates\(/.test(byRel.get(rel) ?? ""),
        `${rel} now has alternates; drop it from EXEMPT`,
      ).toBe(false);
    }
  });
});
