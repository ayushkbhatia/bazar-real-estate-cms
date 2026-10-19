import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * The photos a listing page's gallery grid opens with, for a page of search
 * results, so each card can warm them before the visitor clicks through.
 *
 * Order matches the listing page exactly (`/p/[slug]`): the hero first, then
 * the `gallery` rows by `sort_order`, skipping one that repeats the hero, cut
 * at `limit`. A different order would warm photos the grid does not show.
 *
 * One query for the whole page of results. It is an optimisation only, so a
 * failed read returns an empty map and every card falls back to warming
 * nothing — the search page itself never waits on an error here.
 */
export async function fetchGalleryPreviews(
  rows: { id: string; hero: { storage_key: string } | null }[],
  limit: number,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (rows.length === 0 || !isSupabaseConfigured) return out;

  const keys = new Map<string, string[]>();
  for (const row of rows) {
    keys.set(row.id, row.hero ? [row.hero.storage_key] : []);
  }

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("property_media")
      .select("property_id, sort_order, media:media_assets(storage_key)")
      .in(
        "property_id",
        rows.map((r) => r.id),
      )
      .eq("role", "gallery")
      .order("property_id", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) return out;
    for (const r of data ?? []) {
      const row = r as {
        property_id: string;
        media: { storage_key?: string } | null;
      };
      const key = row.media?.storage_key;
      const list = keys.get(row.property_id);
      if (!key || !list || list.length >= limit || list.includes(key)) {
        continue;
      }
      list.push(key);
    }
  } catch {
    return out;
  }

  for (const [id, list] of keys) {
    out.set(id, list.slice(0, limit).map(mediaPublicUrl).filter(Boolean));
  }
  return out;
}
