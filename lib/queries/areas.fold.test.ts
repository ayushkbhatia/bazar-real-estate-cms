/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { expectFolds, expectNoTwinsLeak } from "@/lib/i18n/fold-harness";
import { composeAreaProfile, type AreaRecordRow } from "./area-profile";
import { SEED_AREA_GUIDES } from "@/lib/seeds/areas";

/**
 * Proof that `areas.name` and `areas.description` fold.
 *
 * `composeAreaProfile` is the choke point — every public read of an area
 * profile goes through it — and it is a pure exported function, so it can be
 * tested directly without a Supabase stub. It takes the RAW row and folds
 * internally, which is not an accident: the intro precedence below has to know
 * whether a translation exists, and a caller that folded first would have
 * thrown that away.
 */

const ROW: AreaRecordRow = {
  id: "a-1",
  slug: "saadiyat-island",
  name: "Saadiyat Island",
  name_ar: "جزيرة السعديات",
  kind: "area",
  description: "A cultural district.",
  description_ar: "حي ثقافي.",
  geo: null,
  seo_meta: null,
};

const read = (locale: Locale) =>
  composeAreaProfile({ row: ROW, guide: null, seed: null, locale });

describe("areas.name / areas.description on /areas/[slug]", () => {
  it("folds the name", async () => {
    await expectFolds({
      read,
      pick: (p) => p?.name,
      english: "Saadiyat Island",
      arabic: "جزيرة السعديات",
      what: "areas.name",
    });
  });

  it("folds the description into the page intro", async () => {
    await expectFolds({
      read,
      pick: (p) => p?.intro,
      english: "A cultural district.",
      arabic: "حي ثقافي.",
      what: "areas.description",
    });
  });

  it("never folds the slug — that is the URL, not a label", () => {
    const ar = composeAreaProfile({
      row: ROW,
      guide: null,
      seed: null,
      locale: "ar" as Locale,
    });
    expect(ar?.slug).toBe("saadiyat-island");
    expectNoTwinsLeak(ar, "area profile");
  });

  it("leaves the English name when the twin is blank", () => {
    const ar = composeAreaProfile({
      row: { ...ROW, name_ar: "   " },
      guide: null,
      seed: null,
      locale: "ar" as Locale,
    });
    expect(ar?.name).toBe("Saadiyat Island");
  });
});

/**
 * The precedence case, which is the whole reason this function folds rather
 * than its caller.
 *
 * `seed?.intro` is English-only editorial living in `lib/seeds/areas.ts` with
 * no Arabic twin. Left ahead of `row.description` it wins on /ar too, dropping
 * a paragraph of English into the top of an Arabic page — while a translation
 * the team actually wrote sits unused one line below it.
 */
describe("intro precedence against the English-only seed", () => {
  // The real seed, with only the intro swapped, so every other field it reads
  // (stats, schools, amenities) is genuinely shaped.
  const seed = {
    ...SEED_AREA_GUIDES.find((g) => g.slug === "saadiyat-island")!,
    intro: "Seed intro, in English.",
  };

  it("keeps the seed intro on English, exactly as before", () => {
    const en = composeAreaProfile({
      row: ROW,
      guide: null,
      seed,
      locale: DEFAULT_LOCALE,
    });
    expect(en?.intro).toBe("Seed intro, in English.");
  });

  it("prefers an authored Arabic description over the English seed", () => {
    const ar = composeAreaProfile({
      row: ROW,
      guide: null,
      seed,
      locale: "ar" as Locale,
    });
    expect(ar?.intro).toBe("حي ثقافي.");
  });

  it("falls back to the seed when there is no Arabic description", () => {
    // Not a regression — an English paragraph beats no paragraph, and the
    // per-field English fallback is the documented behaviour (ADR-0007).
    const ar = composeAreaProfile({
      row: { ...ROW, description_ar: null },
      guide: null,
      seed,
      locale: "ar" as Locale,
    });
    expect(ar?.intro).toBe("Seed intro, in English.");
  });

  it("still lets a published guide win over both", () => {
    const ar = composeAreaProfile({
      row: ROW,
      guide: {
        area_id: "a-1",
        intro_md: "Guide intro.",
        intro_md_ar: "مقدمة الدليل.",
        stats: {},
        schools: [],
        amenities: [],
        related_areas: [],
        hero_image_id: null,
        seo: null,
        published_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      } as never,
      seed,
      locale: "ar" as Locale,
    });
    expect(ar?.intro).toBe("مقدمة الدليل.");
  });
});
