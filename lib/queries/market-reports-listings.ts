/**
 * T1-A cleanup: live comparable resale listings rail for market reports.
 *
 * Pulls a small batch of currently-published `properties` matching an area
 * × property type, ordered by recency. Used on the market-report detail
 * page so visitors who like the numbers can move straight into the live
 * inventory. Mirrors the same `area_slug` + `type` shape the report uses.
 *
 * Kept in its own file (not in the locked `lib/queries/properties.ts`).
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";

export type LiveListing = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  price_aed: number;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  area_name: string | null;
  hero_url: string | null;
  hero_alt: string | null;
};

/*
 * `properties` has no `hero_image_id` column — the hero is a `property_media`
 * row with `role = 'hero'`, the same as everywhere else. The embed here named
 * a foreign key that does not exist, so PostgREST rejected the entire select
 * with PGRST200 ("Could not find a relationship between 'properties' and
 * 'hero_image_id'") and this function returned an empty list on every call.
 * The comparables rail on every market report has been silently blank.
 *
 * Silently, because the destructure below took `{ data }` and never looked at
 * `error` — so a hard 400 was indistinguishable from an area with no matching
 * listings. `error` is now read and logged.
 */
const FIELDS =
  "id, reference, slug, title, price_aed, beds, baths, built_up_ft2, " +
  "areas:area_id(name, slug), " +
  "property_media(role, media:media_assets(storage_key, alt_text))";

const TYPE_TO_DB: Record<string, string> = {
  villa: "villa",
  apartment: "apartment",
  townhouse: "townhouse",
  penthouse: "penthouse",
};

export async function listLiveComparables(opts: {
  area_slug: string;
  property_type: string;
  limit?: number;
}): Promise<LiveListing[]> {
  if (!isSupabaseConfigured) return [];
  const dbType = TYPE_TO_DB[opts.property_type];
  if (!dbType) return [];
  const supabase = createSupabasePublicClient();
  // Two queries: resolve area_id from slug, then pull listings. RLS-public
  // for status=published handles the rest.
  const { data: area } = await supabase
    .from("areas")
    .select("id")
    .eq("slug", opts.area_slug)
    .maybeSingle();
  if (!area?.id) return [];
  const { data, error } = await supabase
    .from("properties")
    .select(FIELDS)
    .eq("status", "published" as never)
    .eq("area_id", area.id)
    .eq("type", dbType as never)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 6);
  if (error) {
    console.error("[listLiveComparables]", error);
    return [];
  }
  return (
    (data as unknown as Array<{
      id: string;
      reference: string;
      slug: string;
      title: string;
      price_aed: number;
      beds: number;
      baths: number;
      built_up_ft2: number | null;
      areas: { name: string; slug: string } | null;
      property_media: Array<{
        role: string;
        media: { storage_key: string; alt_text: string | null } | null;
      }> | null;
    }> | null) ?? []
  ).map((r) => {
    const hero =
      (r.property_media ?? []).find((m) => m.role === "hero")?.media ?? null;
    return {
      id: r.id,
      reference: r.reference,
      slug: r.slug,
      title: r.title,
      price_aed: r.price_aed,
      beds: r.beds,
      baths: r.baths,
      built_up_ft2: r.built_up_ft2,
      area_name: r.areas?.name ?? null,
      hero_url: hero ? mediaPublicUrl(hero.storage_key) : null,
      hero_alt: hero?.alt_text ?? null,
    };
  });
}
