/**
 * The handful of areas a card band names, by slug — the "Our Expertise" band
 * on the home page and /areas.
 *
 * One read for the rows (name folded into the visitor's language, and the hero
 * photo the area's own page leads with), plus a live listing count per area
 * only when the band asks for one — `listAreasWithCounts` counts every area in
 * the emirate, which is ~30 round trips for a band of seven.
 */
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
import { heroUrl } from "@/lib/queries/area-map";

export type AreaCardRecord = {
  slug: string;
  name: string;
  heroUrl: string | null;
  /** Published listings in the area. Only filled when `withCounts` is set. */
  count?: number;
};

/**
 * Keyed by lower-cased slug, because CMS cards have been typed as
 * "Saadiyat-Island" before. Empty when Supabase is absent or the read fails;
 * the band then draws whatever the cards themselves carry.
 */
export async function getAreaCardRecords(
  slugs: string[],
  opts: { withCounts?: boolean } = {},
): Promise<Map<string, AreaCardRecord>> {
  const out = new Map<string, AreaCardRecord>();
  const wanted = [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (!isSupabaseConfigured || wanted.length === 0) return out;
  try {
    const sb = createSupabasePublicClient();
    const { data, error } = await sb
      .from("areas")
      .select("id, slug, name, name_ar, hero:hero_image_id(storage_key, deleted_at)")
      .in("slug", wanted);
    if (error || !data) return out;

    const active = await currentLocale();
    const counts = opts.withCounts
      ? await Promise.all(
          data.map(async (a) => {
            const { count } = await sb
              .from("properties")
              .select("id", { head: true, count: "exact" })
              .eq("area_id", a.id)
              .eq("status", "published");
            return count ?? 0;
          }),
        )
      : null;

    data.forEach((a, i) => {
      const localised = localiseRow(a as unknown as Record<string, unknown>, active) as {
        name: string;
      };
      out.set(a.slug.toLowerCase(), {
        slug: a.slug,
        name: localised.name,
        heroUrl: heroUrl((a as { hero?: unknown }).hero),
        ...(counts ? { count: counts[i] ?? 0 } : {}),
      });
    });
    return out;
  } catch {
    return out;
  }
}
