/**
 * T2-E: Curated-route query helpers.
 *
 * Lives outside `lib/queries/properties.ts` (locked) so we can shape
 * specific curations without touching the canonical listings query. Each
 * function returns `ListingRow[]` so existing card components keep
 * working unchanged.
 *
 * v1 supports:
 *   - exclusive         → `flags @> {exclusive: true}` + recent first
 *   - new-this-week     → `published_at >= now() - 7d`
 *   - price-drops       → no `previous_price` column yet, so we surface
 *                          recently-published listings whose price is
 *                          flagged `price_drop: true`.  Migrate to a
 *                          `price_changes` join when that table lands.
 *
 * Hero image comes from the `property_media` join table (role='hero'),
 * not a direct FK — `hero_image_id` lives on `developments`, not
 * `properties`. Mirrors the pattern in `lib/queries/listings-by-agent.ts`.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { ListingRow } from "@/lib/queries/properties";
import type { Database } from "@/db/types";

type PropertyMode = Database["public"]["Enums"]["property_mode"];
type PropertyTypeEnum = Database["public"]["Enums"]["property_type"];

type RawMediaJoin = {
  role: string;
  media: { storage_key: string; filename: string; alt_text: string | null } | null;
};

const LISTING_FIELDS =
  "id, reference, slug, title, mode, price_aed, beds, baths, built_up_ft2, flags, geo, published_at, created_at, areas:area_id(name, slug), property_media(role, media:media_assets(storage_key, filename, alt_text))";

function mapRows(
  data: (Record<string, unknown> & { property_media?: RawMediaJoin[] })[],
): ListingRow[] {
  return data.map((r) => {
    const joins = r.property_media ?? [];
    const heroJoin = joins.find((j) => j.role === "hero" && j.media);
    const { property_media, ...rest } = r;
    void property_media;
    return { ...rest, hero: heroJoin?.media ?? null } as unknown as ListingRow;
  });
}

export async function listExclusiveProperties(opts: {
  limit?: number;
} = {}): Promise<ListingRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .eq("status", "published" as never)
    .contains("flags", { exclusive: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 24);
  if (error || !data) {
    if (error) console.error("[listExclusiveProperties]", error);
    return [];
  }
  return mapRows(
    data as unknown as (Record<string, unknown> & { property_media?: RawMediaJoin[] })[],
  );
}

export async function listNewThisWeek(opts: {
  limit?: number;
} = {}): Promise<ListingRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .eq("status", "published" as never)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 24);
  if (error || !data) {
    if (error) console.error("[listNewThisWeek]", error);
    return [];
  }
  return mapRows(
    data as unknown as (Record<string, unknown> & { property_media?: RawMediaJoin[] })[],
  );
}

/**
 * Featured listings scoped to a property type / mode — powers the
 * interactive category chips on the /buy landing (Apartment · Villa ·
 * Penthouse · Commercial). Recent-first, DB-linked; returns `[]` when the
 * bucket is empty so the caller can fall back to a general featured row.
 */
export async function listFeaturedByType(
  opts: {
    mode?: PropertyMode;
    type?: PropertyTypeEnum;
    /** Match any of several types (e.g. all commercial formats). */
    types?: PropertyTypeEnum[];
    limit?: number;
  } = {},
): Promise<ListingRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  let query = supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .eq("status", "published" as never);
  if (opts.mode) query = query.eq("mode", opts.mode as never);
  if (opts.type) query = query.eq("type", opts.type as never);
  if (opts.types && opts.types.length)
    query = query.in("type", opts.types as never);
  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 4);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[listFeaturedByType]", error);
    return [];
  }
  return mapRows(
    data as unknown as (Record<string, unknown> & {
      property_media?: RawMediaJoin[];
    })[],
  );
}

export async function listPriceDrops(opts: {
  limit?: number;
} = {}): Promise<ListingRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  // No `price_changes` table yet — surface listings flagged `price_drop`.
  // When the table lands, swap this for a join with the 30-day price-drop
  // delta sort.
  const { data, error } = await supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .eq("status", "published" as never)
    .contains("flags", { price_drop: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 24);
  if (error || !data) {
    if (error) console.error("[listPriceDrops]", error);
    return [];
  }
  return mapRows(
    data as unknown as (Record<string, unknown> & { property_media?: RawMediaJoin[] })[],
  );
}
