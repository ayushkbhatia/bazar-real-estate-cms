/**
 * Area guides — narrative + stats overlay on the `areas` table.
 *
 * /areas/[slug] reads `getAreaGuide(slug)`. /areas (index) reads
 * `listAreasWithCounts()` to render the mosaic with per-area listing
 * counts.
 *
 * Falls back to `lib/seeds/areas.ts` when Supabase is offline or the
 * area_guides table is empty.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { SEED_AREA_GUIDES } from "@/lib/seeds/areas";
import type {
  AreaGuideRow,
  AreaGuideSchool,
  AreaGuideAmenity,
  AreaGuideStat,
} from "@/lib/types/sprint-8";

export type AreaGuide = {
  area_id: string | null;
  slug: string;
  name: string;
  intro_md: string;
  stats: AreaGuideStat;
  schools: AreaGuideSchool[];
  amenities: AreaGuideAmenity[];
  related_area_slugs: string[];
  hero_image: { storage_key: string; alt_text: string | null } | null;
  published_at: string | null;
};

export type AreaIndexEntry = {
  id: string;
  slug: string;
  name: string;
  listing_count: number;
  guide_published: boolean;
};

// ─────────────────────────────────────────────────────────────────────
// getAreaGuide
// ─────────────────────────────────────────────────────────────────────
export async function getAreaGuide(slug: string): Promise<AreaGuide | null> {
  if (!slug) return null;
  if (isSupabaseConfigured) {
    try {
      const sb = createSupabasePublicClient();
      // Resolve area_id from slug first (areas table is in db/types.ts).
      const { data: area } = await sb
        .from("areas")
        .select("id, slug, name")
        .eq("slug", slug)
        .maybeSingle();
      if (area) {
        const { data: guide } = await sb
          .from("area_guides")
          .select("*")
          .eq("area_id", area.id)
          .not("published_at", "is", null)
          .maybeSingle();
        if (guide) {
          const g = guide as AreaGuideRow;
          return {
            area_id: area.id,
            slug: area.slug,
            name: area.name,
            intro_md: g.intro_md ?? "",
            stats: g.stats ?? {},
            schools: g.schools ?? [],
            amenities: g.amenities ?? [],
            related_area_slugs: [],
            hero_image: null,
            published_at: g.published_at,
          };
        }
      }
    } catch {
      // fall through to seed
    }
  }
  return seedAreaGuide(slug);
}

function seedAreaGuide(slug: string): AreaGuide | null {
  const seed = SEED_AREA_GUIDES.find((g) => g.slug === slug);
  if (!seed) return null;
  return {
    area_id: null,
    slug: seed.slug,
    name: seed.name,
    intro_md: seed.intro,
    stats: {
      medianApt: seed.stats.median_apt_aed_per_ft2,
      medianVilla: seed.stats.median_villa_aed_per_ft2,
      daysOnMarket: seed.stats.avg_dom_days,
      yoyChange: seed.stats.yoy_change_pct,
    },
    schools: seed.schools.map((s) => ({
      name: s.name,
      kind: "school" as const,
      distance_km: s.distance_km,
    })),
    amenities: seed.amenities.map((label) => ({
      name: label,
      kind: "mall" as const,
      distance_km: 0,
    })),
    related_area_slugs: seed.similar_areas,
    hero_image: null,
    published_at: new Date().toISOString(),
  };
}

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
