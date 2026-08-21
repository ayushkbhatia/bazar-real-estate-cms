import { describe, it, expect } from "vitest";
import { composeAreaProfile, type AreaRecordRow } from "./area-profile";
import { SEED_AREA_GUIDES } from "@/lib/seeds/areas";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { PROPER_NOUNS } from "@/lib/i18n/mt/proper-nouns";
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
      expect(p.vibe).toBe(arabicFor(seed.vibe));
      expect(p.vibe).not.toBe(seed.vibe);
    });

    it("drops the vibe rather than falling back to English", () => {
      // A vibe the store has never seen. Every real one is translated, so the
      // fall-through is only reachable with a made-up value.
      const untranslated = { ...seed, vibe: "Nothing in the store says this" };
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

  /**
   * The whole seed folds, not just the fields somebody remembered.
   *
   * `intro` was wired for Arabic and `amenities` was not, and the only reason
   * is that the fold used to happen per read site. `localiseSeed` runs once in
   * `composeAreaProfile`, so this asserts against the composed profile rather
   * than against the helper.
   */
  describe("the seed folds to the locale", () => {
    const saadiyat = SEED_AREA_GUIDES.find((s) => s.slug === "saadiyat-island")!;
    const ar = () =>
      composeAreaProfile({
        row: null,
        guide: null,
        seed: saadiyat,
        locale: "ar",
      })!;

    it("translates the intro, the position line and the amenities", () => {
      const p = ar();
      expect(p.intro).toBe(arabicFor(saadiyat.intro));
      expect(p.position).toBe(arabicFor(saadiyat.position));
      expect(p.amenities).toEqual(
        saadiyat.amenities.map((a) => arabicFor(a) ?? a),
      );
      expect(p.amenities).not.toEqual(saadiyat.amenities);
    });

    it("reaches inside the school rows", () => {
      const p = ar();
      expect(p.schools[0]!.name).toBe(arabicFor(saadiyat.schools[0]!.name));
      expect(p.schools[0]!.curriculum).toBe(
        arabicFor(saadiyat.schools[0]!.curriculum),
      );
    });

    it("reaches inside the dossier the lifestyle band renders", () => {
      const seed = ar().seed!;
      expect(seed.lifestyle_prose).toBe(arabicFor(saadiyat.lifestyle_prose));
      expect(seed.commute_chips![0]!.label).toBe(
        arabicFor(saadiyat.commute_chips![0]!.label),
      );
      const pick = seed.dining_picks![0]!;
      expect(pick.note).toBe(arabicFor(saadiyat.dining_picks![0]!.note));
      // A venue brand that keeps its Latin name is left alone rather than
      // transliterated — see PROPER_NOUNS, confidence "keep-latin".
      expect(pick.name).toBe(saadiyat.dining_picks![0]!.name);
    });

    it("keeps the non-prose fields out of the fold", () => {
      const p = ar();
      expect(p.slug).toBe(saadiyat.slug);
      expect(p.similarSlugs).toEqual(saadiyat.similar_areas);
      expect(p.seed!.commute_chips![0]!.mode).toBe(
        saadiyat.commute_chips![0]!.mode,
      );
    });

    it("changes nothing in English", () => {
      const p = composeAreaProfile({
        row: null,
        guide: null,
        seed: saadiyat,
        locale: "en",
      })!;
      expect(p.intro).toBe(saadiyat.intro);
      expect(p.amenities).toEqual(saadiyat.amenities);
      expect(p.seed!.lifestyle_prose).toBe(saadiyat.lifestyle_prose);
    });
  });

  /**
   * Every English string the seed renders publicly, and the store's answer for
   * it. A new seed — or a reworded intro — fails here rather than shipping an
   * English paragraph onto an Arabic page.
   *
   * Names are exempt where the store deliberately has no answer: a venue brand
   * that keeps its Latin name is registered in `PROPER_NOUNS` as `keep-latin`,
   * which is a decision, not a gap.
   */
  it("ships Arabic for every string the seed renders", () => {
    const latin = new Set(
      PROPER_NOUNS.filter((n) => n.confidence === "keep-latin").map((n) =>
        n.en.toLowerCase(),
      ),
    );
    const gaps: string[] = [];
    const check = (where: string, value: string | null | undefined) => {
      if (!value || latin.has(value.toLowerCase())) return;
      if (!arabicFor(value)) gaps.push(`${where}: ${value}`);
    };
    for (const s of SEED_AREA_GUIDES) {
      check(`${s.slug}.intro`, s.intro);
      check(`${s.slug}.position`, s.position);
      check(`${s.slug}.vibe`, s.vibe);
      check(`${s.slug}.lifestyle_prose`, s.lifestyle_prose);
      s.amenities.forEach((a) => check(`${s.slug}.amenities`, a));
      s.schools.forEach((x) => {
        check(`${s.slug}.schools.name`, x.name);
        check(`${s.slug}.schools.curriculum`, x.curriculum);
      });
      s.commute_chips?.forEach((c) => check(`${s.slug}.commute_chips`, c.label));
      s.dining_picks?.forEach((d) => {
        check(`${s.slug}.dining_picks.name`, d.name);
        check(`${s.slug}.dining_picks.kind`, d.kind);
        check(`${s.slug}.dining_picks.note`, d.note);
      });
    }
    expect(
      gaps,
      "Seed copy with no Arabic. Either translate it into " +
        "lib/master-pages/arabic/master.json, or — for a brand that keeps its " +
        "Latin name — register it in PROPER_NOUNS as keep-latin.\n\n" +
        gaps.join("\n"),
    ).toEqual([]);
  });
});
