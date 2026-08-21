import { describe, it, expect } from "vitest";
import { composeAreaProfile, type AreaRecordRow } from "./area-profile";
import { SEED_AREA_GUIDES } from "@/lib/seeds/areas";
import type { AreaGuideRow } from "@/lib/types/sprint-8";

const seed = SEED_AREA_GUIDES.find((s) => s.slug === "saadiyat-island")!;

const dbRow: AreaRecordRow = {
  id: "a1",
  slug: "ramhan-island",
  name: "Ramhan Island",
  kind: "area",
  description: "A private-island community east of the city.",
  geo: { lat: 24.51, lng: 54.86 },
  seo_meta: { meta_title: "Ramhan Island homes", meta_description: null },
};

const guideRow = (over: Partial<AreaGuideRow> = {}): AreaGuideRow => ({
  area_id: "a1",
  intro_md: null,
  stats: {},
  schools: [],
  amenities: [],
  related_areas: [],
  hero_image_id: null,
  seo: null,
  published_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("composeAreaProfile", () => {
  it("returns null only when nothing matches the slug", () => {
    expect(
      composeAreaProfile({ row: null, guide: null, seed: null }),
    ).toBeNull();
  });

  it("builds a renderable profile from the database row alone", () => {
    const p = composeAreaProfile({ row: dbRow, guide: null, seed: null })!;
    expect(p.id).toBe("a1");
    expect(p.name).toBe("Ramhan Island");
    expect(p.intro).toBe("A private-island community east of the city.");
    expect(p.geo).toEqual({ lat: 24.51, lng: 54.86 });
    expect(p.metaTitle).toBe("Ramhan Island homes");
    expect(p.metaDescription).toBeNull();
  });

  it("hides the data bands for a brand-new area", () => {
    const p = composeAreaProfile({ row: dbRow, guide: null, seed: null })!;
    expect(p.stats).toBeNull();
    expect(p.schools).toEqual([]);
    expect(p.amenities).toEqual([]);
    expect(p.similarSlugs).toEqual([]);
    expect(p.seed).toBeNull();
  });

  it("still resolves a seed-only area, with no id", () => {
    const p = composeAreaProfile({ row: null, guide: null, seed })!;
    expect(p.id).toBeNull();
    expect(p.name).toBe(seed.name);
    expect(p.intro).toBe(seed.intro);
    expect(p.stats?.medianAptPerFt2).toBe(seed.stats.median_apt_aed_per_ft2);
    expect(p.seed).toBe(seed);
  });

  it("prefers the published guide over the seed", () => {
    const p = composeAreaProfile({
      row: { ...dbRow, slug: seed.slug, name: seed.name },
      guide: guideRow({
        intro_md: "Rewritten by the editorial team.",
        stats: { medianApt: 2400, yoyChange: -1.5 },
        related_areas: ["yas-island"],
      }),
      seed,
    })!;
    expect(p.intro).toBe("Rewritten by the editorial team.");
    expect(p.stats).toEqual({
      medianAptPerFt2: 2400,
      medianVillaPerFt2: null,
      avgDaysOnMarket: null,
      yoyChangePct: -1.5,
    });
    expect(p.similarSlugs).toEqual(["yas-island"]);
  });

  it("falls back to seed stats when the guide publishes none", () => {
    const p = composeAreaProfile({
      row: { ...dbRow, slug: seed.slug },
      guide: guideRow({ stats: {} }),
      seed,
    })!;
    expect(p.stats?.medianAptPerFt2).toBe(seed.stats.median_apt_aed_per_ft2);
  });

  it("reads a seeded zero as 'not published', not as a headline zero", () => {
    const villaless = {
      ...seed,
      stats: { ...seed.stats, median_villa_aed_per_ft2: 0 },
    };
    const p = composeAreaProfile({ row: null, guide: null, seed: villaless })!;
    expect(p.stats?.medianVillaPerFt2).toBeNull();
    expect(p.stats?.medianAptPerFt2).not.toBeNull();
  });

  it("ignores a malformed geo blob rather than placing a pin at NaN", () => {
    const p = composeAreaProfile({
      row: { ...dbRow, geo: { lat: "not-a-number", lng: 54.86 } },
      guide: null,
      seed: null,
    })!;
    expect(p.geo).toBeNull();
  });

  it("keeps the database name and slug when a seed of the same slug exists", () => {
    const p = composeAreaProfile({
      row: { ...dbRow, slug: seed.slug, name: "Saadiyat (renamed)" },
      guide: null,
      seed,
    })!;
    expect(p.name).toBe("Saadiyat (renamed)");
    expect(p.slug).toBe(seed.slug);
    // Editorial extras still come through from the seed.
    expect(p.position).toBe(seed.position);
    expect(p.vibe).toBe(seed.vibe);
  });

  /*
   * The hero eyebrow reads "Community guide · {vibe}", so an English vibe on
   * `/ar` is three English words inside an otherwise Arabic line — on all 24
   * area guides, which is what made it the most visible untranslated string on
   * the route.
   */
  describe("the vibe follows the locale", () => {
    it("gives the Arabic vibe on ar", () => {
      const p = composeAreaProfile({
        row: null,
        guide: null,
        seed,
        locale: "ar",
      })!;
      expect(p.vibe).toBe(seed.vibe_ar);
      expect(p.vibe).not.toBe(seed.vibe);
    });

    it("drops the vibe rather than falling back to English", () => {
      const untranslated = { ...seed, vibe_ar: undefined };
      const p = composeAreaProfile({
        row: null,
        guide: null,
        seed: untranslated,
        locale: "ar",
      })!;
      expect(p.vibe).toBeNull();
    });

    it("leaves English untouched", () => {
      const p = composeAreaProfile({
        row: null,
        guide: null,
        seed,
        locale: "en",
      })!;
      expect(p.vibe).toBe(seed.vibe);
    });
  });

  it("ships an Arabic vibe for every seed that has an English one", () => {
    const missing = SEED_AREA_GUIDES.filter((s) => s.vibe && !s.vibe_ar).map(
      (s) => s.slug,
    );
    expect(missing).toEqual([]);
  });
});
