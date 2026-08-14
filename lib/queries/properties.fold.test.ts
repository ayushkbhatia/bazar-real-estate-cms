/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { expectFolds, expectNoTwinsLeak } from "@/lib/i18n/fold-harness";

/**
 * Proof that the six public `properties` text columns fold.
 *
 * These are the whole text of a listing — headline, blurb, long description,
 * address, view, orientation — so this is the fold with the most behind it.
 *
 * The trap here is not the shaper (`attachHero` spreads, it does not rebuild)
 * but the FOUR call sites, every one of which launders the result through
 * `as unknown as ListingRow[]`. That cast erases a `Promise<ListingRow>[]`
 * completely, so making `attachHero` async — the obvious way to add a fold —
 * type-checks, lints, builds, and renders every listing card on /buy, /rent,
 * /off-plan, /commercial, the home grid and /agents/[slug] with undefined in
 * every field. `attachHero` therefore takes a locale and stays synchronous,
 * and the last test here pins that.
 */

let nextRows: unknown = [];
let locale: Locale = DEFAULT_LOCALE;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/i18n/current", () => ({ currentLocale: async () => locale }));

function stub() {
  return {
    from: () => {
      const q: Record<string, unknown> = {};
      const chain = new Proxy(q, {
        get(_t, prop: string) {
          if (prop === "then")
            return (res: (v: unknown) => unknown) =>
              Promise.resolve({
                data: nextRows,
                error: null,
                count: Array.isArray(nextRows) ? nextRows.length : 0,
              }).then(res);
          return () => chain;
        },
      });
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => stub(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => stub(),
}));

import {
  getPublishedPropertyByReference,
  listPublishedProperties,
} from "./properties";

const DETAIL = {
  id: "p-1",
  reference: "BAZ-AD-08114",
  slug: "villa-08114",
  title: "Four-bed villa on Saadiyat",
  title_ar: "فيلا من أربع غرف في السعديات",
  short_description: "Beachfront living.",
  short_description_ar: "معيشة على الشاطئ.",
  description: "A long description.",
  description_ar: "وصف طويل.",
  price_aed: 9_200_000,
  mode: "sale",
  status: "published",
  type: "villa",
  beds: 4,
  baths: 5,
  view: "Sea",
  view_ar: "بحر",
  orientation: "NW",
  orientation_ar: "شمال غربي",
  address_line: "Plot 12, Saadiyat",
  address_line_ar: "قطعة ١٢، السعديات",
  amenities: [],
  flags: null,
  areas: { name: "Saadiyat Island", slug: "saadiyat-island" },
  developments: null,
  property_media: [
    {
      role: "hero",
      sort_order: 0,
      media: {
        storage_key: "listings/a.jpg",
        filename: "a.jpg",
        alt_text: "Front elevation",
        alt_text_ar: "الواجهة الأمامية",
      },
    },
  ],
};

async function readDetail(l: Locale) {
  locale = l;
  nextRows = DETAIL;
  return getPublishedPropertyByReference("BAZ-AD-08114");
}

const SIX: { key: keyof typeof DETAIL; en: string; ar: string }[] = [
  { key: "title", en: DETAIL.title, ar: DETAIL.title_ar },
  {
    key: "short_description",
    en: DETAIL.short_description,
    ar: DETAIL.short_description_ar,
  },
  { key: "description", en: DETAIL.description, ar: DETAIL.description_ar },
  { key: "address_line", en: DETAIL.address_line, ar: DETAIL.address_line_ar },
  { key: "view", en: DETAIL.view, ar: DETAIL.view_ar },
  { key: "orientation", en: DETAIL.orientation, ar: DETAIL.orientation_ar },
];

describe("properties detail fold — /p/[slug]", () => {
  it.each(SIX)("folds properties.$key", async ({ key, en, ar }) => {
    await expectFolds({
      read: readDetail,
      pick: (d) => (d as unknown as Record<string, unknown> | null)?.[key],
      english: en,
      arabic: ar,
      what: `properties.${String(key)}`,
    });
  });

  it("folds the nested alt text in the same pass", async () => {
    await expectFolds({
      read: readDetail,
      pick: (d) => d?.hero?.alt_text,
      english: "Front elevation",
      arabic: "الواجهة الأمامية",
      what: "media_assets.alt_text (property hero)",
    });
  });

  it("honours an explicit locale over the ambient one", async () => {
    // What the OG route relies on. It is a metadata route with no
    // `setRequestLocale` above it, so it must pass DEFAULT_LOCALE rather than
    // let an ambient read make the route dynamic.
    locale = "ar" as Locale;
    nextRows = DETAIL;
    const forced = await getPublishedPropertyByReference(
      "BAZ-AD-08114",
      DEFAULT_LOCALE,
    );
    expect(forced?.title).toBe(DETAIL.title);
  });
});

describe("properties listing fold — /buy, /rent and the rest", () => {
  it("folds title and short_description on the list path", async () => {
    const read = async (l: Locale) => {
      locale = l;
      nextRows = [DETAIL];
      return listPublishedProperties({});
    };
    await expectFolds({
      read,
      pick: (r) => r.rows[0]?.title,
      english: DETAIL.title,
      arabic: DETAIL.title_ar,
      what: "properties.title (list)",
    });
    await expectFolds({
      read,
      pick: (r) => r.rows[0]?.short_description,
      english: DETAIL.short_description,
      arabic: DETAIL.short_description_ar,
      what: "properties.short_description (list)",
    });
  });

  /**
   * The cast trap, stated as a test rather than a comment.
   *
   * Every call site does `... .map((row) => attachHero(row)) as unknown as
   * ListingRow[]`. If `attachHero` ever becomes async, each row is a Promise
   * and the cast hides it — so `rows[0].title` would be `undefined` and
   * nothing else in the suite would notice.
   */
  it("returns rows, not promises", async () => {
    locale = DEFAULT_LOCALE;
    nextRows = [DETAIL];
    const { rows } = await listPublishedProperties({});
    expect(rows[0]).not.toBeInstanceOf(Promise);
    expect(rows[0]?.title).toBe(DETAIL.title);
    expectNoTwinsLeak(rows, "listing rows");
  });
});
