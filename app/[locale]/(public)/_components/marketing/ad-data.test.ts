import { describe, expect, it } from "vitest";
import { AD_AREAS } from "./ad-data";
import { SEED_AREA_GUIDES } from "@/lib/seeds/areas";
import { arabicFor } from "@/lib/i18n/arabic-store";

/**
 * The "Abu Dhabi locations" band on /off-plan reads its rows from this
 * constant and overlays live listing counts onto them, matched on `slug`.
 *
 * Both halves of that sentence have already failed silently once, which is why
 * they are pinned here rather than left to review:
 *
 *  - Matching used to be on `name`. "Al Raha Beach" is `al-raha` in the
 *    catalogue and is named "Al Raha" there, so that row rendered with no count
 *    and a link to the unfiltered search — in production, for as long as the
 *    section has existed. A slug typo puts it straight back, and nothing about
 *    the page looks broken when it happens.
 *  - The Arabic comes from `ARABIC_STORE`, keyed by the English. The twins on
 *    the rows are declared and empty, which is what makes `localiseRow`
 *    consult the store at all — so an English edit here silently drops that
 *    row back to English under `/ar` unless the store is updated with it.
 */
const SEED_SLUGS = new Set(SEED_AREA_GUIDES.map((a) => a.slug));

describe("AD_AREAS", () => {
  it("carries a slug that exists in the area catalogue", () => {
    const unknown = AD_AREAS.filter((a) => !SEED_SLUGS.has(a.slug));
    expect(unknown.map((a) => `${a.name} → ${a.slug}`)).toEqual([]);
  });

  it("uses each slug once", () => {
    const slugs = AD_AREAS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has Arabic for every string it renders", () => {
    const missing = AD_AREAS.flatMap((a) =>
      (["name", "tagline", "about"] as const)
        .filter((key) => arabicFor(a[key]) === null)
        .map((key) => `${a.slug}.${key}`),
    );
    expect(missing).toEqual([]);
  });

  it("declares the empty Arabic twins localiseRow needs to find them", () => {
    // `localiseRow` only consults the store for a key whose `_ar` twin EXISTS
    // on the row — a guard against swapping a slug or an id for a coincidental
    // store hit. A row without the twin keys renders in English under `/ar`
    // however much Arabic the store holds.
    for (const area of AD_AREAS) {
      for (const twin of ["name_ar", "tagline_ar", "about_ar"] as const) {
        expect(twin in area, `${area.slug} is missing ${twin}`).toBe(true);
      }
    }
  });
});
