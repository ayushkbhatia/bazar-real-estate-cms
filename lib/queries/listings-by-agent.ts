/**
 * Listings assigned to a specific advisor — backs the "Active listings"
 * section on `/agents/[slug]`.
 *
 * Lives outside `lib/queries/properties.ts` (locked) so curation-style
 * filters can be added without touching the canonical listings query.
 * Mirrors the pattern in `lib/queries/curated-listings.ts`.
 */
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { ListingRow } from "@/lib/queries/properties";

// The `hero` slot on a properties row is sourced from the property_media
// join table (not a direct hero_image_id FK — that column lives on
// developments, not properties). We pull the role='hero' join row and
// surface its media_assets reference as `hero` so callers can keep using
// `row.hero?.storage_key`.
const LISTING_FIELDS =
  "id, reference, slug, title, mode, price_aed, beds, baths, built_up_ft2, flags, geo, published_at, created_at, areas:area_id(name, slug), property_media(role, media:media_assets(storage_key, filename, alt_text))";

type RawMediaJoin = {
  role: string;
  media: { storage_key: string; filename: string; alt_text: string | null } | null;
};

export async function listListingsByAgent(
  userId: string,
  opts: { limit?: number } = {},
): Promise<ListingRow[]> {
  if (!isSupabaseConfigured || !userId) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .eq("status", "published" as never)
    .eq("assigned_agent_id", userId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 6);
  if (error || !data) {
    if (error) console.error("[listListingsByAgent]", error);
    return [];
  }
  return (data as unknown as (Record<string, unknown> & { property_media?: RawMediaJoin[] })[]).map(
    (r) => {
      const joins = r.property_media ?? [];
      const heroJoin = joins.find((j) => j.role === "hero" && j.media);
      const { property_media, ...rest } = r;
      void property_media;
      return { ...rest, hero: heroJoin?.media ?? null } as unknown as ListingRow;
    },
  );
}
