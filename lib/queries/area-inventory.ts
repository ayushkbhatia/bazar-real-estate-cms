/**
 * What is actually for sale, to rent, and under construction in one area.
 *
 * The area guide's three inventory bands used to run through
 * `listPublishedProperties({ filters: { area } })`, which resolves the slug to a
 * single `area_id` and matches on it exactly. That is right for a search page —
 * "area = Saadiyat Lagoons" should mean that community and nothing else — but
 * wrong for a guide: /areas/saadiyat-island is the page for the whole island,
 * and a villa filed under Saadiyat Lagoons is a Saadiyat listing. Sub-community
 * rows exist precisely so stock can be filed at that grain.
 *
 * So this resolves the area *and its children* and queries across the set. A
 * sub-community page resolves to itself alone — it has no children, and rolling
 * up to its parent would put the whole island on a community's page.
 *
 * It carries its own select rather than extending `lib/queries/properties.ts`:
 * that module is shared by every listing surface in the app, and widening its
 * area filter to accept a set would change what `?area=` means on /buy/search
 * as a side effect. The duplicated column list is the cheaper of the two.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { ListingRow } from "@/lib/queries/properties";
import {
  listPublishedDevelopments,
  type DevelopmentIndexRow,
} from "@/lib/queries/developments";

/** Mirrors LISTING_FIELDS in lib/queries/properties.ts — keep them in step. */
const LISTING_FIELDS =
  "id, reference, slug, title, short_description, price_aed, mode, property_form, status, type, beds, baths, built_up_ft2, flags, geo, published_at, created_at, areas:area_id(name, slug), property_media(role, media:media_assets(storage_key, filename, alt_text))";

type RawMediaJoin = {
  role: string;
  media: {
    storage_key: string;
    filename: string;
    alt_text: string | null;
  } | null;
};

function attachHero(row: Record<string, unknown>): ListingRow {
  const { property_media, ...rest } = row as {
    property_media?: RawMediaJoin[] | null;
  } & Record<string, unknown>;
  const hero =
    (property_media ?? []).find((j) => j.role === "hero" && j.media)?.media ??
    null;
  return { ...rest, hero } as unknown as ListingRow;
}

/** An area and the sub-communities filed under it. */
export type AreaTree = { ids: string[]; slugs: string[] };

export type AreaInventory = {
  /** The area's own id plus its sub-communities'. Empty when the slug is unknown. */
  areaIds: string[];
  /** Everything that is not a tenancy — ready, resale, off-plan and commercial. */
  forSale: ListingRow[];
  forRent: ListingRow[];
  /** Published projects in the area, newest first. */
  developments: DevelopmentIndexRow[];
  /** Totals across the area tree, for "view all" links that mean something. */
  saleTotal: number;
  rentTotal: number;
  developmentTotal: number;
};

const EMPTY: AreaInventory = {
  areaIds: [],
  forSale: [],
  forRent: [],
  developments: [],
  saleTotal: 0,
  rentTotal: 0,
  developmentTotal: 0,
};

/**
 * An area's own id and slug, plus any sub-community filed under it.
 *
 * Slugs are unique table-wide (0076), so the lookup takes the first match
 * rather than `.maybeSingle()` — a legacy duplicate resolves to the older row
 * instead of throwing, matching `getAreaProfile`.
 */
export async function resolveAreaTree(slug: string): Promise<AreaTree> {
  const empty = { ids: [], slugs: [] };
  if (!isSupabaseConfigured || !slug) return empty;
  const sb = createSupabasePublicClient();
  const { data: self } = await sb
    .from("areas")
    .select("id, slug")
    .eq("slug", slug)
    .order("created_at", { ascending: true })
    .limit(1);
  const row = self?.[0];
  if (!row) return empty;

  const { data: children } = await sb
    .from("areas")
    .select("id, slug")
    .eq("parent_id", row.id);
  return {
    ids: [row.id, ...(children ?? []).map((c) => c.id)],
    slugs: [row.slug, ...(children ?? []).map((c) => c.slug)],
  };
}

/**
 * Both inventory bands and the projects rail, for one area.
 *
 * `limit` is per band. The guide shows six of each; the totals come back
 * separately so the "view all" links can be honest about how much is behind
 * them.
 */
export async function getAreaInventory(
  slug: string,
  limit = 6,
): Promise<AreaInventory> {
  if (!isSupabaseConfigured) return EMPTY;
  try {
    const tree = await resolveAreaTree(slug);
    if (tree.ids.length === 0) return EMPTY;
    const areaIds = tree.ids;
    const areaSlugs = new Set(tree.slugs);

    const sb = createSupabasePublicClient();
    const base = () =>
      sb
        .from("properties")
        .select(LISTING_FIELDS, { count: "exact" })
        .eq("status", "published")
        .is("deleted_at", null)
        .in("area_id", areaIds)
        .order("published_at", { ascending: false });

    const [sale, rent, allDevelopments] = await Promise.all([
      // "For sale" is everything that is not a tenancy: ready, resale, off-plan
      // and commercial all belong under it. Filtering on mode = 'buy' would
      // empty the band on the islands whose stock is entirely off-plan.
      base().neq("mode", "rent").limit(limit),
      base().eq("mode", "rent").limit(limit),
      listPublishedDevelopments(),
    ]);

    // The index row carries its area as a joined `{name, slug}`, not an id, so
    // the match is on slug. Filtering in memory is fine at this scale — the
    // whole published-projects list is tens of rows, not thousands.
    const developments = allDevelopments.filter(
      (d) => d.area?.slug && areaSlugs.has(d.area.slug),
    );

    return {
      areaIds,
      forSale: ((sale.data ?? []) as unknown as Record<string, unknown>[]).map(
        attachHero,
      ),
      forRent: ((rent.data ?? []) as unknown as Record<string, unknown>[]).map(
        attachHero,
      ),
      developments,
      saleTotal: sale.count ?? 0,
      rentTotal: rent.count ?? 0,
      developmentTotal: developments.length,
    };
  } catch (error) {
    console.error(`[area-inventory] failed for "${slug}"`, error);
    return EMPTY;
  }
}
