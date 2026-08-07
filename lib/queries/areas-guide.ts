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
export async function listAreasWithCounts(): Promise<AreaIndexEntry[]> {
  if (!isSupabaseConfigured) return seedAreaIndex();
  try {
    const sb = createSupabasePublicClient();
    const { data: areas, error } = await sb
      .from("areas")
      .select("id, slug, name, kind")
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

    return areas.map((a, i) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
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
