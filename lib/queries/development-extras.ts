/**
 * Companion queries for the development detail page (T1-C additions).
 *
 * Kept separate from `lib/queries/developments.ts` so the locked query module
 * stays untouched. All functions here are public-read (RLS-gated to
 * `published_at IS NOT NULL`).
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { DevelopmentIndexRow } from "./developments";

const SIBLING_FIELDS =
  "id, name, slug, status, handover_date, total_units, starting_price, tagline, bedrooms_text, description, published_at, developers:developer_id(name, slug), areas:area_id(name, slug), hero:hero_image_id(storage_key, filename, alt_text)";

/** Other developments in the same area, excluding the current one. */
export async function listOtherDevelopmentsInArea(opts: {
  excludeId: string;
  areaId: string;
  limit?: number;
}): Promise<DevelopmentIndexRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select(SIBLING_FIELDS)
    .eq("area_id", opts.areaId)
    .neq("id", opts.excludeId)
    .not("published_at", "is", null)
    .order("handover_date", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 4);
  return (
    (data as unknown as DevelopmentIndexRow[] | null)?.map((d) => ({
      ...d,
      developer:
        (d as unknown as { developers: { name: string; slug: string } | null })
          .developers ?? null,
      area:
        (d as unknown as { areas: { name: string; slug: string } | null })
          .areas ?? null,
    })) ?? []
  );
}

/** Other developments by the same developer, excluding the current one. */
export async function listOtherDevelopmentsByDeveloper(opts: {
  excludeId: string;
  developerId: string;
  limit?: number;
}): Promise<DevelopmentIndexRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select(SIBLING_FIELDS)
    .eq("developer_id", opts.developerId)
    .neq("id", opts.excludeId)
    .not("published_at", "is", null)
    .order("handover_date", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 4);
  return (
    (data as unknown as DevelopmentIndexRow[] | null)?.map((d) => ({
      ...d,
      developer:
        (d as unknown as { developers: { name: string; slug: string } | null })
          .developers ?? null,
      area:
        (d as unknown as { areas: { name: string; slug: string } | null })
          .areas ?? null,
    })) ?? []
  );
}

/**
 * Optional development meta blob — fetched separately from the main detail
 * query so we don't have to change DETAIL_FIELDS in the locked module. Keys
 * we care about:
 *
 *   - meta.feature_blocks: NamedFeatureBlock[]
 *   - meta.faq: { q: string; a: string }[]
 *   - meta.coords: { lat: number; lng: number }
 *   - meta.floorplan_gated: boolean
 *   - meta.is_signature: boolean
 *
 * All optional; the components handle missing data gracefully.
 */
export type DevelopmentMeta = {
  feature_blocks?: NamedFeatureBlock[];
  faq?: FaqEntry[];
  coords?: { lat: number; lng: number };
  floorplan_gated?: boolean;
  is_signature?: boolean;
} & Record<string, unknown>;

export type NamedFeatureBlock = {
  key: string;
  title: string;
  copy: string;
  /** Tailwind class fragment we can route an image into in a follow-up
   *  once the media-asset picker lands. For v1 it's optional. */
  image_role?: string;
};

export type FaqEntry = { q: string; a: string };

export async function getDevelopmentMeta(
  developmentId: string,
): Promise<DevelopmentMeta | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select("meta")
    .eq("id", developmentId)
    .maybeSingle();
  return (data?.meta as DevelopmentMeta | null) ?? null;
}

/**
 * T2-G cleanup: bulk signature-flag lookup for the developer profile
 * "Signature buildings" carousel.  Returns a Set of development IDs where
 * `meta.is_signature === true`.  When the meta column is unpopulated for
 * a developer's portfolio, the Set is empty and the carousel renders the
 * top N projects as a fallback — graceful degradation.
 */
export async function getSignatureDevelopmentIds(
  ids: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  if (!isSupabaseConfigured || ids.length === 0) return out;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select("id, meta")
    .in("id", ids);
  for (const row of (data as Array<{ id: string; meta: unknown }> | null) ??
    []) {
    const m = row.meta as DevelopmentMeta | null;
    if (m?.is_signature === true) out.add(row.id);
  }
  return out;
}

/**
 * T1-C cleanup: bulk coords lookup for the "Future developments around"
 * map.  Returns a per-id coords record (entries omitted when missing /
 * malformed).  Pulls a single SELECT against developments + filters
 * client-side rather than calling getDevelopmentMeta() N times.
 */
export async function getDevelopmentCoordsBulk(
  ids: string[],
): Promise<Record<string, { lat: number; lng: number } | null>> {
  const out: Record<string, { lat: number; lng: number } | null> = {};
  if (!isSupabaseConfigured || ids.length === 0) return out;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select("id, meta")
    .in("id", ids);
  for (const row of (data as Array<{ id: string; meta: unknown }> | null) ?? []) {
    const m = row.meta as DevelopmentMeta | null;
    const c = m?.coords;
    if (
      c &&
      typeof c.lat === "number" &&
      typeof c.lng === "number" &&
      Number.isFinite(c.lat) &&
      Number.isFinite(c.lng)
    ) {
      out[row.id] = { lat: c.lat, lng: c.lng };
    } else {
      out[row.id] = null;
    }
  }
  return out;
}
