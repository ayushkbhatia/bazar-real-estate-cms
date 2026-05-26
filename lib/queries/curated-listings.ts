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
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { ListingRow } from "@/lib/queries/properties";

type AreaRel = { name: string; slug: string } | null;
type HeroRel = {
  storage_key: string;
  filename: string;
  alt_text: string | null;
} | null;

const LISTING_FIELDS =
  "id, reference, slug, title, mode, price_aed, beds, baths, built_up_ft2, flags, geo, published_at, created_at, areas:area_id(name, slug), hero:hero_image_id(storage_key, filename, alt_text)";

function mapRow(r: Record<string, unknown>): ListingRow {
  return r as unknown as ListingRow & {
    areas: AreaRel;
    hero: HeroRel;
  };
}

export async function listExclusiveProperties(opts: {
  limit?: number;
} = {}): Promise<ListingRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .eq("status", "published" as never)
    .contains("flags", { exclusive: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 24);
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(mapRow);
}

export async function listNewThisWeek(opts: {
  limit?: number;
} = {}): Promise<ListingRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .eq("status", "published" as never)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 24);
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(mapRow);
}

export async function listPriceDrops(opts: {
  limit?: number;
} = {}): Promise<ListingRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  // No `price_changes` table yet — surface listings flagged `price_drop`.
  // When the table lands, swap this for a join with the 30-day price-drop
  // delta sort.
  const { data } = await supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .eq("status", "published" as never)
    .contains("flags", { price_drop: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 24);
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(mapRow);
}
