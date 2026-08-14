/**
 * The area index — one entry per top-level area with its live listing count,
 * behind the `/areas` card grid, the home-page location tiles, the off-plan
 * area filter and the sitemap.
 *
 * One area resolved for its own page is `lib/queries/area-profile.ts`.
 *
 * Falls back to `lib/seeds/areas.ts` when Supabase is offline.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
import { type Locale } from "@/lib/i18n/locales";

import { SEED_AREA_GUIDES } from "@/lib/seeds/areas";

export type AreaIndexEntry = {
  id: string;
  slug: string;
  name: string;
  listing_count: number;
  guide_published: boolean;
};

// ─────────────────────────────────────────────────────────────────────
// listAreasWithCounts
// ─────────────────────────────────────────────────────────────────────
export async function listAreasWithCounts(
  /*
   * Optional, and callers outside the [locale] segment MUST pass one.
   * `app/sitemap.ts` is the reason this parameter exists: it sits at the root,
   * has no `setRequestLocale` above it, and an ambient read there is a dynamic
   * API. The G-1 guard caught exactly that — "/sitemap.xml was prerendered and
   * is now rendered on demand" — on the commit that added the fold below.
   */
  locale?: Locale,
): Promise<AreaIndexEntry[]> {
  if (!isSupabaseConfigured) return seedAreaIndex();
  try {
    const sb = createSupabasePublicClient();
    const { data: areas, error } = await sb
      .from("areas")
      .select("id, slug, name, name_ar, kind")
      .eq("kind", "area")
      .order("name", { ascending: true });
    if (error || !areas || areas.length === 0) return seedAreaIndex();

    // Per-area listing counts. One Postgres roundtrip via `count` per area
    // is fine at v1 (we have ~10 areas, not 10k). When that changes, push
    // into a materialised view.
    const counts = await Promise.all(
      areas.map(async (a) => {
        const { count } = await sb
          .from("properties")
          .select("id", { head: true, count: "exact" })
          .eq("area_id", a.id)
          .eq("status", "published");
        return count ?? 0;
      }),
    );

    // Which areas have a published guide?
    const ids = areas.map((a) => a.id);
    const { data: guides } = await sb
      .from("area_guides")
      .select("area_id, published_at")
      .in("area_id", ids)
      .not("published_at", "is", null);
    const guideSet = new Set(
      (guides ?? []).map((g: { area_id: string }) => g.area_id),
    );

    const active = locale ?? (await currentLocale());
    return areas.map((a, i) => ({
      id: a.id,
      slug: a.slug,
      // Display only. `slug` is the URL and stays as authored.
      name: (
        localiseRow(a as unknown as Record<string, unknown>, active) as {
          name: string;
        }
      ).name,
      listing_count: counts[i] ?? 0,
      guide_published: guideSet.has(a.id),
    }));
  } catch {
    return seedAreaIndex();
  }
}

function seedAreaIndex(): AreaIndexEntry[] {
  return SEED_AREA_GUIDES.map((g, i) => ({
    id: `seed:${g.slug}`,
    slug: g.slug,
    name: g.name,
    listing_count: 3 + ((i * 7) % 13),
    guide_published: true,
  }));
}
