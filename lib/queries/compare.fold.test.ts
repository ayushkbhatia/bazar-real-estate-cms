/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { expectFolds, expectNoTwinsLeak } from "@/lib/i18n/fold-harness";

/**
 * Proof that the compare/shortlist reader folds — including the AREA JOIN.
 *
 * Two distinct failures lived here, and neither was visible from the code:
 *
 *  1. **The join.** `localiseRow` walks one level and stops, so
 *     `areas: { name, name_ar }` arrived as one opaque value with nothing to
 *     pair `name_ar` against. `area_name` was then lifted straight off the raw
 *     row. The result was an Arabic listing card captioned "Al Reem Island",
 *     on both the shortlist drawer and every compare column. `localiseJoins`
 *     is the fix; a spec is the only thing that can tell it apart from the
 *     no-op it replaced.
 *
 *  2. **The locale.** `/api/shortlist` is in `NON_LOCALISED`, so it never sits
 *     under `[locale]`, nothing calls `setRequestLocale` for it, and
 *     `currentLocale()` answers "en" no matter who asked. The drawer therefore
 *     listed English titles beside Arabic ones on the compare page — same
 *     query, two answers. The override parameter is what the route passes, and
 *     the third test pins that it beats the ambient read rather than merely
 *     existing.
 */

let nextRows: unknown = [];
let ambient: Locale = DEFAULT_LOCALE;
let selectString = "";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/i18n/current", () => ({ currentLocale: async () => ambient }));

function stub() {
  return {
    from: () => {
      const q: Record<string, unknown> = {};
      const chain = new Proxy(q, {
        get(_t, prop: string) {
          if (prop === "then")
            return (res: (v: unknown) => unknown) =>
              Promise.resolve({ data: nextRows, error: null }).then(res);
          if (prop === "select")
            return (s?: string) => {
              if (typeof s === "string") selectString = s;
              return chain;
            };
          return () => chain;
        },
      });
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => stub(),
}));

import { getComparableProperties } from "./compare";

const ID = "11111111-1111-4111-8111-111111111111";

const ROW = {
  id: ID,
  reference: "BAZ-AD-01302",
  slug: "muheira",
  title: "Tara Park",
  title_ar: "تارا بارك",
  price_aed: 3_300_000,
  mode: "sale",
  status: "published",
  type: "apartment",
  beds: 3,
  baths: 2,
  built_up_ft2: 1560,
  plot_ft2: null,
  floor: 24,
  year_built: null,
  tenure: "freehold",
  furnishing: null,
  view: "Sea",
  view_ar: "بحر",
  parking_bays: 2,
  service_charge_per_ft2: null,
  amenities: ["Concierge"],
  flags: null,
  published_at: null,
  created_at: "2026-01-01T00:00:00Z",
  areas: { name: "Al Reem Island", name_ar: "جزيرة الريم", slug: "al-reem" },
  property_media: [],
};

async function read(locale: Locale) {
  nextRows = [{ ...ROW }];
  ambient = locale;
  const rows = await getComparableProperties([ID]);
  return rows[0]!;
}

describe("getComparableProperties folds", () => {
  it("asks the database for the area's twin", async () => {
    await read("ar");
    expect(
      selectString.includes("name_ar"),
      "a fold is equally dead if the twin column never left the database",
    ).toBe(true);
  });

  it("folds areas.name through the join", async () => {
    await expectFolds({
      read,
      pick: (r) => r.area_name,
      english: "Al Reem Island",
      arabic: "جزيرة الريم",
      what: "areas.name (compare join)",
    });
  });

  it("folds the listing's own title", async () => {
    await expectFolds({
      read,
      pick: (r) => r.title,
      english: "Tara Park",
      arabic: "تارا بارك",
      what: "properties.title (compare)",
    });
  });

  it("leaves the slug alone — it is an identifier, not prose", async () => {
    const ar = await read("ar");
    expect(ar.area_slug).toBe("al-reem");
  });

  it("falls back to the English when nothing anywhere has the Arabic", async () => {
    // Deliberately a name the shared store has never seen. A real Abu Dhabi
    // toponym would NOT fall back — `localiseRow` resolves a blank twin
    // through `arabicFor`, which is the designed second chance and would make
    // this assertion pass for the wrong reason.
    nextRows = [
      {
        ...ROW,
        areas: { name: "Nowhere Bay", name_ar: null, slug: "nowhere-bay" },
      },
    ];
    ambient = "ar";
    const rows = await getComparableProperties([ID]);
    expect(rows[0]!.area_name).toBe("Nowhere Bay");
    expectNoTwinsLeak(rows[0], "blank area twin");
  });

  it("still resolves a blank twin through the shared store", async () => {
    // The other half of the same rule, and the more valuable one: prod areas
    // largely have their `name_ar` filled, but a new one will not, and the
    // store is what stops it rendering Latin inside an Arabic card.
    nextRows = [{ ...ROW, areas: { ...ROW.areas, name_ar: null } }];
    ambient = "ar";
    const rows = await getComparableProperties([ID]);
    expect(rows[0]!.area_name).toBe("جزيرة الريم");
  });

  it("lets the caller override the ambient locale", async () => {
    // What `/api/shortlist` relies on: it has no ambient locale to read, so
    // an override that merely existed but lost to `currentLocale()` would
    // leave the drawer in English forever.
    nextRows = [{ ...ROW }];
    ambient = DEFAULT_LOCALE;
    const rows = await getComparableProperties([ID], 25, "ar");
    expect(rows[0]!.area_name).toBe("جزيرة الريم");
    expect(rows[0]!.title).toBe("تارا بارك");
    expectNoTwinsLeak(rows[0], "override fold");
  });

  it("still returns English when the override says so on an Arabic request", async () => {
    nextRows = [{ ...ROW }];
    ambient = "ar";
    const rows = await getComparableProperties([ID], 25, DEFAULT_LOCALE);
    expect(rows[0]!.title).toBe("Tara Park");
  });
});
