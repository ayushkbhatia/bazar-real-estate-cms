/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import {
  expectBlankTwinFallsBack,
  expectFolds,
  expectNoTwinsLeak,
} from "@/lib/i18n/fold-harness";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://project-one.supabase.co" },
  isSupabaseConfigured: true,
}));

const {
  AREA_FIELDS,
  DEVELOPMENT_FIELDS,
  PROPERTY_FIELDS,
  resolveInternalLinks,
  shapeArea,
  shapeDevelopment,
  shapeProperty,
} = await import("./resolve");

const AR = "ar" as Locale;
const EN = "en" as Locale;

const AREA_ID = "0d4c6b8e-5a1f-4e2b-9c3d-7f8e9a0b1c2d";
const DEV_ID = "33333333-0000-0000-0000-000000000008";
const PROP_ID = "44444444-0000-0000-0000-000000000001";

const AREA_ROW = {
  id: AREA_ID,
  slug: "mamsha-al-saadiyat",
  name: "Mamsha Al Saadiyat",
  name_ar: "ممشى السعديات",
  description: "Beachfront apartments beside the cultural district.",
  description_ar: "شقق على الشاطئ بجوار المنطقة الثقافية.",
  hero: null,
  parent: {
    name: "Saadiyat Island",
    name_ar: "جزيرة السعديات",
    hero: {
      storage_key: "listings/p-saadiyat.jpg",
      alt_text: "Saadiyat beach",
      alt_text_ar: "شاطئ السعديات",
      deleted_at: null,
    },
  },
};

const DEV_ROW = {
  id: DEV_ID,
  slug: "saadiyat-lagoons",
  name: "Saadiyat Lagoons",
  name_ar: "بحيرات السعديات",
  tagline: "Waterfront villas",
  tagline_ar: "فلل على الواجهة المائية",
  starting_price: "5200000",
  handover_date: "2027-11-30",
  developers: { name: "Aldar", name_ar: "الدار" },
  areas: { name: "Saadiyat Island", name_ar: "جزيرة السعديات" },
  hero: {
    storage_key: "listings/lagoons.jpg",
    alt_text: "Lagoon villas",
    alt_text_ar: "فلل البحيرة",
    deleted_at: null,
  },
};

const PROP_ROW = {
  id: PROP_ID,
  reference: "BAZ-AD-04891",
  slug: "sea-view-villa",
  title: "Sea-view villa",
  title_ar: "فيلا بإطلالة على البحر",
  price_aed: 12500000,
  mode: "buy",
  type: "villa",
  beds: 5,
  baths: 6,
  built_up_ft2: 6200,
  areas: { name: "Saadiyat Island", name_ar: "جزيرة السعديات" },
  property_media: [
    { role: "gallery", media: { storage_key: "listings/g.jpg", alt_text: "G", alt_text_ar: "ج", deleted_at: null } },
    { role: "hero", media: { storage_key: "listings/h.jpg", alt_text: "Front", alt_text_ar: "الواجهة", deleted_at: null } },
  ],
};

describe("area link cards", () => {
  const read = (locale: Locale) => shapeArea({ ...AREA_ROW }, locale);

  it("fold the name, the summary and the parent one level down", async () => {
    await expectFolds({ read, pick: (r) => r.name, english: "Mamsha Al Saadiyat", arabic: "ممشى السعديات", what: "areas.name (link card)" });
    await expectFolds({ read, pick: (r) => r.summary, english: AREA_ROW.description, arabic: AREA_ROW.description_ar, what: "areas.description (link card)" });
    await expectFolds({ read, pick: (r) => r.parent, english: "Saadiyat Island", arabic: "جزيرة السعديات", what: "areas.name (parent, link card)" });
  });

  it("borrow the parent's photograph, alt text folded", async () => {
    await expectFolds({ read, pick: (r) => r.image?.alt, english: "Saadiyat beach", arabic: "شاطئ السعديات", what: "media_assets.alt_text (area link card)" });
    expect(read(EN).image?.url).toBe(
      "https://project-one.supabase.co/storage/v1/object/public/media/listings/p-saadiyat.jpg",
    );
  });

  it("never fold the slug or the href", () => {
    const ar = read(AR);
    expect(ar.slug).toBe("mamsha-al-saadiyat");
    expect(ar.href).toBe("/areas/mamsha-al-saadiyat");
    expectNoTwinsLeak(ar, "area link card");
  });

  it("keep the English where the twin is blank", async () => {
    await expectBlankTwinFallsBack({
      read: (locale) => shapeArea({ ...AREA_ROW, description_ar: "  " }, locale),
      pick: (r) => r.summary,
      english: AREA_ROW.description,
      what: "areas.description (link card, blank twin)",
    });
  });

  it("show no image rather than a trashed one", () => {
    const shaped = shapeArea(
      {
        ...AREA_ROW,
        parent: { ...AREA_ROW.parent, hero: { ...AREA_ROW.parent.hero, deleted_at: "2026-09-01" } },
      },
      EN,
    );
    expect(shaped.image).toBeNull();
  });
});

describe("project link cards", () => {
  const read = (locale: Locale) => shapeDevelopment({ ...DEV_ROW }, locale);

  it("fold the name, tagline, developer and area", async () => {
    await expectFolds({ read, pick: (r) => r.name, english: "Saadiyat Lagoons", arabic: "بحيرات السعديات", what: "developments.name (link card)" });
    await expectFolds({ read, pick: (r) => r.tagline, english: "Waterfront villas", arabic: "فلل على الواجهة المائية", what: "developments.tagline (link card)" });
    await expectFolds({ read, pick: (r) => r.developer, english: "Aldar", arabic: "الدار", what: "developers.name (link card)" });
    await expectFolds({ read, pick: (r) => r.area, english: "Saadiyat Island", arabic: "جزيرة السعديات", what: "areas.name (project link card)" });
  });

  it("carry the numbers as numbers and the href from the slug", () => {
    const ar = read(AR);
    expect(ar.startingPriceAed).toBe(5_200_000);
    expect(ar.handoverDate).toBe("2027-11-30");
    expect(ar.href).toBe("/developments/saadiyat-lagoons");
    expectNoTwinsLeak(ar, "project link card");
  });
});

describe("listing link cards", () => {
  const read = (locale: Locale) => shapeProperty({ ...PROP_ROW }, locale);

  it("fold the title and the area", async () => {
    await expectFolds({ read, pick: (r) => r.name, english: "Sea-view villa", arabic: "فيلا بإطلالة على البحر", what: "properties.title (link card)" });
    await expectFolds({ read, pick: (r) => r.area, english: "Saadiyat Island", arabic: "جزيرة السعديات", what: "areas.name (listing link card)" });
  });

  it("use the hero photograph, not the first one", async () => {
    await expectFolds({ read, pick: (r) => r.image?.alt, english: "Front", arabic: "الواجهة", what: "media_assets.alt_text (listing link card)" });
  });

  it("build the canonical listing URL", () => {
    const ar = read(AR);
    expect(ar.href).toBe("/p/sea-view-villa-baz-ad-04891");
    expect(ar.priceAed).toBe(12_500_000);
    expectNoTwinsLeak(ar, "listing link card");
  });
});

describe("the selects", () => {
  it("ask for every twin they fold", () => {
    // A fold is just as dead if the column never left the database.
    for (const twin of ["name_ar", "description_ar", "alt_text_ar"]) {
      expect(AREA_FIELDS).toContain(twin);
    }
    for (const twin of ["name_ar", "tagline_ar", "alt_text_ar"]) {
      expect(DEVELOPMENT_FIELDS).toContain(twin);
    }
    for (const twin of ["title_ar", "name_ar", "alt_text_ar"]) {
      expect(PROPERTY_FIELDS).toContain(twin);
    }
  });
});

/**
 * A client whose tables answer from fixtures. The harness's `queryStub`
 * answers every table with one payload; this lookup queries three tables in
 * one call, so it needs one per table — and a way to make one of them fail.
 */
function fakeClient(
  tables: Record<string, { data?: unknown; error?: unknown; count?: number }>,
) {
  const from: string[] = [];
  return {
    from,
    client: {
      from(table: string) {
        from.push(table);
        const answer = tables[table] ?? { data: [] };
        const chain: Record<string, unknown> = new Proxy(
          {},
          {
            get(_t, prop: string) {
              if (prop === "then")
                return (res: (v: unknown) => unknown) =>
                  Promise.resolve({
                    data: answer.data ?? null,
                    error: answer.error ?? null,
                    count: answer.count ?? null,
                  }).then(res);
              return () => chain;
            },
          },
        );
        return chain;
      },
    } as never,
  };
}

describe("resolveInternalLinks", () => {
  const refs = [
    { kind: "area" as const, id: AREA_ID },
    { kind: "development" as const, id: DEV_ID },
    { kind: "property" as const, id: PROP_ID },
  ];

  it("asks once per kind, however many links there are", async () => {
    const fake = fakeClient({
      areas: { data: [AREA_ROW] },
      developments: { data: [DEV_ROW] },
      properties: { data: [PROP_ROW], count: 7 },
    });
    const lookup = await resolveInternalLinks(
      [...refs, ...refs, { kind: "area", id: AREA_ID.toUpperCase() }],
      EN,
      fake.client,
    );
    // areas + developments + properties, plus one listing count per area.
    expect(fake.from.filter((t) => t === "areas")).toHaveLength(1);
    expect(fake.from.filter((t) => t === "developments")).toHaveLength(1);
    expect(fake.from.filter((t) => t === "properties")).toHaveLength(2);

    const area = lookup.get(refs[0]);
    expect(area?.kind).toBe("area");
    expect(area && "listings" in area ? area.listings : -1).toBe(7);
    expect(lookup.get(refs[1])?.name).toBe("Saadiyat Lagoons");
    expect(lookup.get(refs[2])?.href).toBe("/p/sea-view-villa-baz-ad-04891");
  });

  it("answers null for a record that is not public", async () => {
    const fake = fakeClient({ developments: { data: [] } });
    const lookup = await resolveInternalLinks([refs[1]], EN, fake.client);
    expect(lookup.get(refs[1])).toBeNull();
  });

  it("answers undefined — unknown, not gone — when a kind's read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = fakeClient({
      areas: { data: [AREA_ROW] },
      developments: { error: { message: "timeout" } },
    });
    const lookup = await resolveInternalLinks(refs.slice(0, 2), EN, fake.client);
    expect(lookup.get(refs[0])?.name).toBe("Mamsha Al Saadiyat");
    expect(lookup.get(refs[1])).toBeUndefined();
    error.mockRestore();
  });

  it("answers undefined for a record it was never asked about", async () => {
    const fake = fakeClient({ areas: { data: [AREA_ROW] } });
    const lookup = await resolveInternalLinks([refs[0]], EN, fake.client);
    expect(lookup.get(refs[2])).toBeUndefined();
  });

  it("answers undefined for everything without a database", async () => {
    const lookup = await resolveInternalLinks(refs, EN, null);
    for (const ref of refs) expect(lookup.get(ref)).toBeUndefined();
  });

  it("makes no query for an article with no links", async () => {
    const fake = fakeClient({});
    await resolveInternalLinks([], EN, fake.client);
    expect(fake.from).toHaveLength(0);
  });

  it("folds what it returns", async () => {
    const fake = fakeClient({ developments: { data: [DEV_ROW] } });
    const lookup = await resolveInternalLinks([refs[1]], AR, fake.client);
    const hit = lookup.get(refs[1]);
    expect(hit?.name).toBe("بحيرات السعديات");
    expectNoTwinsLeak(hit, "resolved project link");
  });
});
