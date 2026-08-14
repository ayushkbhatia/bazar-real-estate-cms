/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import {
  expectBlankTwinFallsBack,
  expectFolds,
  expectNoTwinsLeak,
} from "@/lib/i18n/fold-harness";

/**
 * Proof that `media_assets.alt_text` folds on the development read paths.
 *
 * This column is the reason `pickHero` had to learn about locale. Every read of
 * it in the codebase is a NESTED PostgREST join — `hero:hero_image_id(...)`,
 * `media:media_id(...)` — and `localiseRow` walks exactly one level. So the
 * fold already applied to the development row never reached
 * `raw.hero.alt_text_ar`, and `pickHero` then rebuilt the media object as an
 * explicit literal, discarding the twin for good.
 *
 * Two silent failures stacked on each other, which is why this file asserts on
 * the reader's real output rather than on the helper.
 */

let devRow: Record<string, unknown> = {};
let locale: Locale = "en" as Locale;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/i18n/current", () => ({
  currentLocale: async () => locale,
}));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      const chain = new Proxy(q, {
        get(_t, prop: string) {
          if (prop === "then")
            return (res: (v: unknown) => unknown) =>
              Promise.resolve({ data: devRow, error: null }).then(res);
          return () => chain;
        },
      });
      return chain;
    },
  }),
}));

import { getPublishedDevelopmentBySlug } from "./developments";

function row(over: Record<string, unknown> = {}) {
  return {
    id: "d-1",
    name: "Saadiyat Lagoons",
    name_ar: "بحيرات السعديات",
    slug: "saadiyat-lagoons",
    status: "on_sale",
    handover_date: null,
    total_units: 312,
    starting_price: 6_200_000,
    tagline: "Lagoon living",
    tagline_ar: null,
    bedrooms_text: "3–6 bed",
    bedrooms_text_ar: null,
    description: "A lagoon community.",
    description_ar: null,
    vision: null,
    vision_ar: null,
    facts: {},
    payment_plan: null,
    master_plan: {},
    amenities: [],
    amenities_ar: null,
    escrow_account: null,
    seo: null,
    published_at: "2026-01-01T00:00:00Z",
    developer_id: null,
    area_id: null,
    lead_advisor_id: null,
    hero: {
      storage_key: "dev/hero.jpg",
      filename: "hero.jpg",
      alt_text: "Aerial view of the lagoon",
      alt_text_ar: "منظر جوي للبحيرة",
    },
    masterplan: {
      storage_key: "dev/plan.jpg",
      filename: "plan.jpg",
      alt_text: "Site plan",
      alt_text_ar: "المخطط العام",
    },
    developers: null,
    areas: null,
    ...over,
  };
}

async function read(l: Locale) {
  locale = l;
  devRow = row();
  return getPublishedDevelopmentBySlug("saadiyat-lagoons");
}

describe("media_assets.alt_text on /developments/[slug]", () => {
  it("folds the hero alt text out of a nested join", async () => {
    await expectFolds({
      read,
      pick: (d) => d?.hero?.alt_text,
      english: "Aerial view of the lagoon",
      arabic: "منظر جوي للبحيرة",
      what: "media_assets.alt_text (hero)",
    });
  });

  it("folds the masterplan alt text too", async () => {
    await expectFolds({
      read,
      pick: (d) => d?.masterplan?.alt_text,
      english: "Site plan",
      arabic: "المخطط العام",
      what: "media_assets.alt_text (masterplan)",
    });
  });

  it("leaves the English alt showing when the twin is blank", async () => {
    await expectBlankTwinFallsBack({
      read: async (l) => {
        locale = l;
        devRow = row({
          hero: {
            storage_key: "dev/hero.jpg",
            filename: "hero.jpg",
            alt_text: "Aerial view of the lagoon",
            alt_text_ar: "   ",
          },
        });
        return getPublishedDevelopmentBySlug("saadiyat-lagoons");
      },
      pick: (d) => d?.hero?.alt_text,
      english: "Aerial view of the lagoon",
      what: "media_assets.alt_text (blank twin)",
    });
  });

  it("survives a development with no images", async () => {
    locale = "ar" as Locale;
    devRow = row({ hero: null, masterplan: null });
    const d = await getPublishedDevelopmentBySlug("saadiyat-lagoons");
    expect(d?.hero).toBeNull();
    expect(d?.masterplan).toBeNull();
    expectNoTwinsLeak(d, "development with no images");
  });

  it("folds the row's own columns in the same pass", async () => {
    // Guards the ordering: `pickHero` now takes a locale, and threading it
    // through `shapeIndexRow` is where a careless edit would drop the outer
    // fold instead.
    await expectFolds({
      read,
      pick: (d) => d?.name,
      english: "Saadiyat Lagoons",
      arabic: "بحيرات السعديات",
      what: "developments.name",
    });
  });
});
