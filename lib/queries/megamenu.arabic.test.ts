/**
 * @vitest-environment node
 *
 * The Arabic a person typed into the megamenu editor has to still be there
 * when they reload the page.
 *
 * It was not. Every layer around this one looked correct — the write schemas
 * required each twin, the save action wrote them, the admin select listed
 * them, and the public menu rendered Arabic fine — so the field-by-field
 * evidence all said the feature worked. What sat between the select and the
 * editor was `buildMegamenu`, which reshapes the raw rows into explicit
 * literals (`label: i.label`) and therefore dropped every `_ar` key it was
 * not individually told to carry. The twins were fetched and then thrown
 * away, so the editor rendered blank inputs over a database full of Arabic.
 *
 * The test that should have caught it asserted the query string CONTAINS
 * "label_ar". It did contain it. Selecting a column and returning it are
 * different claims, and only the second one is the feature.
 *
 * So this file asserts the second: real rows go in through the real loader,
 * and the Arabic comes out the other end. It never inspects source text.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const TAB = {
  id: "tab-1",
  slug: "buy",
  label: "Buy",
  label_ar: "شراء",
  href: null,
  has_panel: true,
  position: 0,
  panel_title: "Buy property in Abu Dhabi",
  panel_title_ar: "شراء عقارات في أبوظبي",
  panel_title_href: "/buy",
  right_column_title: "Abu Dhabi locations",
  right_column_title_ar: "مواقع أبوظبي",
  status: "published" as const,
};

const COLUMNS = [
  {
    id: "col-left",
    tab_id: "tab-1",
    zone: "left" as const,
    position: 0,
    heading: "Property type",
    heading_ar: "نوع العقار",
  },
  {
    id: "col-right",
    tab_id: "tab-1",
    zone: "right" as const,
    position: 0,
    heading: "Locations",
    heading_ar: "المواقع",
  },
];

const ITEMS = [
  {
    id: "item-1",
    column_id: "col-left",
    position: 0,
    label: "Villas",
    label_ar: "فلل",
    href: "/buy/villas",
    target_kind: "custom" as const,
    target_id: null,
    icon: null,
    badge_label: "New",
    badge_label_ar: "جديد",
    badge_variant: "neutral" as const,
  },
  {
    id: "item-2",
    column_id: "col-right",
    position: 0,
    label: "Saadiyat Island",
    label_ar: "جزيرة السعديات",
    href: "/areas/saadiyat",
    target_kind: "area" as const,
    target_id: "area-1",
    icon: null,
    badge_label: null,
    badge_label_ar: null,
    badge_variant: "neutral" as const,
  },
];

const TILES = [
  {
    id: "tile-1",
    tab_id: "tab-1",
    position: 0,
    variant: "dark" as const,
    badge_label: "Launch",
    badge_label_ar: "إطلاق",
    badge_kind: "dot" as const,
    headline: "A new waterfront address",
    headline_ar: "عنوان جديد على الواجهة البحرية",
    href: "/off-plan",
    media_asset_id: null,
    media: null,
    cta_label: "Explore",
    cta_label_ar: "استكشف",
  },
];

/**
 * Just enough PostgREST to answer the four reads the loader makes. Filters are
 * applied for real so the column/item join is exercised rather than assumed.
 */
function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = {
    megamenu_tabs: [TAB],
    megamenu_columns: COLUMNS,
    megamenu_items: ITEMS,
    megamenu_featured_tiles: TILES,
  };

  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        select: () => builder,
        order: () => builder,
        eq: (col: string, val: unknown) => {
          rows = rows.filter((r) => r[col] === val);
          return builder;
        },
        in: (col: string, vals: unknown[]) => {
          rows = rows.filter((r) => vals.includes(r[col]));
          return builder;
        },
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
          resolve({ data: rows, error: null }),
      };
      return builder;
    },
  };
}

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => fakeClient()),
}));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: vi.fn(() => fakeClient()),
}));
vi.mock("@/lib/i18n/current", () => ({ currentLocale: vi.fn(async () => "en") }));

import { getMegamenuTabBySlugForAdmin, getPublishedMegamenu } from "./megamenu";

beforeEach(() => vi.clearAllMocks());

describe("the admin loader returns the Arabic, not just selects it", () => {
  it("keeps the tab's own twins", async () => {
    const tab = await getMegamenuTabBySlugForAdmin("buy");
    expect(tab?.label_ar).toBe("شراء");
    expect(tab?.panel_title_ar).toBe("شراء عقارات في أبوظبي");
    expect(tab?.right_column_title_ar).toBe("مواقع أبوظبي");
  });

  it("keeps the twins on columns in both zones", async () => {
    const tab = await getMegamenuTabBySlugForAdmin("buy");
    expect(tab?.columns.left[0]?.heading_ar).toBe("نوع العقار");
    // The right zone is shaped by a second, near-duplicate branch. A fix
    // applied to one and not the other would pass a left-only assertion.
    expect(tab?.columns.right[0]?.heading_ar).toBe("المواقع");
  });

  it("keeps the twins on items nested inside columns", async () => {
    const tab = await getMegamenuTabBySlugForAdmin("buy");
    const item = tab?.columns.left[0]?.items[0];
    expect(item?.label_ar).toBe("فلل");
    expect(item?.badge_label_ar).toBe("جديد");
    expect(tab?.columns.right[0]?.items[0]?.label_ar).toBe("جزيرة السعديات");
  });

  it("keeps the twins on featured tiles", async () => {
    const tile = (await getMegamenuTabBySlugForAdmin("buy"))?.featured[0];
    expect(tile?.badge_label_ar).toBe("إطلاق");
    expect(tile?.headline_ar).toBe("عنوان جديد على الواجهة البحرية");
    expect(tile?.cta_label_ar).toBe("استكشف");
  });

  it("still returns the English alongside it", async () => {
    // Carrying the twins must not disturb the fields that already worked.
    const tab = await getMegamenuTabBySlugForAdmin("buy");
    expect(tab?.label).toBe("Buy");
    expect(tab?.columns.left[0]?.heading).toBe("Property type");
    expect(tab?.columns.left[0]?.items[0]?.label).toBe("Villas");
    expect(tab?.featured[0]?.headline).toBe("A new waterfront address");
  });
});

describe("the public menu is unchanged by the twins riding along", () => {
  it("renders English under the English locale", async () => {
    const menu = await getPublishedMegamenu("en");
    const tab = menu.tabs[0];
    expect(tab?.label).toBe("Buy");
    expect(tab?.columns.left[0]?.items[0]?.label).toBe("Villas");
  });

  it("still folds Arabic into the base field under the Arabic locale", async () => {
    // The public path folds twins onto their English key BEFORE shaping. The
    // renderers read `label`, never `label_ar`, so the fold — not the carry —
    // is what makes the Arabic menu work, and it has to keep working.
    const menu = await getPublishedMegamenu("ar");
    const tab = menu.tabs[0];
    expect(tab?.label).toBe("شراء");
    expect(tab?.panel_title).toBe("شراء عقارات في أبوظبي");
    expect(tab?.columns.left[0]?.heading).toBe("نوع العقار");
    expect(tab?.columns.left[0]?.items[0]?.label).toBe("فلل");
    expect(tab?.featured[0]?.headline).toBe("عنوان جديد على الواجهة البحرية");
  });
});
