/**
 * Area-map queries — power the interactive area map on the home page and
 * the map band on /areas/[slug].
 *
 * Two reads, both shaped as plain serialisable objects so a Server
 * Component can hand them straight to the lazy client map with zero
 * per-request work (this is what keeps `/` static / ISR):
 *
 *   · listAreaPins(emirate)      → one pin per area (centroid + count + stats)
 *   · listAreaListingDots(opts)  → one lightweight dot per published listing
 *
 * Stats + tags come from the seed area guides (lib/seeds/areas.ts), so an
 * area created in the CMS pins with a count but no figures. `getAreaProfile`
 * (lib/queries/area-profile.ts) already merges the `area_guides` overlay for
 * the detail page — swap `seedStatsForSlug` for it once the client populates
 * that table at handover, and the two surfaces stay in lockstep.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";

// Deep import, not the `@/lib/preferences` barrel: the barrel re-exports
// `provider.tsx`, which is `"use client"`, and dragging a client boundary into
// a server-side query module is how you accidentally bundle React state into
// a data layer.
import { formatArea } from "@/lib/preferences/formatters";
import type { AreaUnit } from "@/lib/preferences/types";
import { SEED_AREA_GUIDES } from "@/lib/seeds/areas";

export type LngLat = { lng: number; lat: number };

export type AreaPin = {
  id: string;
  slug: string;
  name: string;
  /** Emirate slug the area belongs to, e.g. "abu-dhabi". */
  emirate: string;
  /** Short editorial descriptor for the flyout, or null to hide it. */
  tag: string | null;
  lng: number;
  lat: number;
  /** Published-listing count — the number shown in the pill. */
  count: number;
  /** Headline median AED/ft², or null when we have no figure. */
  medianPerFt2: number | null;
  /** Year-on-year price change %, or null. */
  yoyChange: number | null;
};

/**
 * One listing on the map. Everything numeric travels raw — the popup is a
 * client component and formats in the visitor's currency and area unit, so a
 * pre-formatted string here would be frozen at AED/ft² forever.
 *
 * These fields round-trip through MapLibre's GeoJSON worker, whose tile
 * encoder does not reliably preserve `null`. Hence `priceAed: 0` as the
 * "price on request" sentinel rather than a nullable number.
 */
export type AreaDot = {
  slug: string;
  reference: string;
  lng: number;
  lat: number;
  /** Raw AED. `0` means the listing publishes no price. */
  priceAed: number;
  title: string;
  /** Beds for the subtitle, or null. */
  beds: number | null;
  /** Built-up area in ft² for the subtitle, or null. */
  builtUpFt2: number | null;
  /**
   * Pre-built subtitle for sources that have no beds/area to render — the
   * off-plan map uses "Developer · Area". Takes precedence over
   * `beds`/`builtUpFt2` when set, and carries no units, so it is safe frozen.
   */
  metaText: string | null;
};

const DEFAULT_EMIRATE = "abu-dhabi";

// Short editorial descriptors for the flyout. Mirrors the handoff's
// BZ_AREAS `tag` copy for the seven core areas; the rest are written in
// the same voice. Missing slug → null (the flyout drops the line).
const AREA_TAGS: Record<string, string> = {
  "saadiyat-island": "Cultural quarter · beachfront",
  "yas-island": "Family · waterfront",
  "al-reem-island": "Investor · high yield",
  "al-maryah": "ADGM · trophy assets",
  adgm: "Financial free-zone · freehold",
  "al-raha": "Townhouses · marina",
  corniche: "Urban · historic",
  "khalifa-city": "Villas · community",
  "masdar-city": "Sustainable · walkable",
  kizad: "Industrial · logistics",
  mussafah: "Industrial · value",
  "nurai-island": "Private island · ultra-prime",
};

// Hand-verified centroids for the offline / seed path (Supabase not
// configured). Mirrors 0039_area_geo_centroids.sql — keep in lockstep.
const AREA_CENTROIDS: Record<string, LngLat> = {
  "saadiyat-island": { lng: 54.435, lat: 24.545 },
  "yas-island": { lng: 54.605, lat: 24.488 },
  "al-reem-island": { lng: 54.404, lat: 24.5 },
  "al-maryah": { lng: 54.386, lat: 24.499 },
  adgm: { lng: 54.382, lat: 24.503 },
  "al-raha": { lng: 54.606, lat: 24.452 },
  corniche: { lng: 54.349, lat: 24.476 },
  "khalifa-city": { lng: 54.578, lat: 24.42 },
  "masdar-city": { lng: 54.617, lat: 24.427 },
  kizad: { lng: 54.683, lat: 24.717 },
  mussafah: { lng: 54.494, lat: 24.35 },
  "nurai-island": { lng: 54.47, lat: 24.59 },
};

// ─────────────────────────────────────────────────────────────────────
// Pure helpers — exported for unit tests, no Supabase/network.
// ─────────────────────────────────────────────────────────────────────

/** Read a `{lat,lng}` jsonb blob into a validated LngLat, or null. */
export function parseGeo(geo: unknown): LngLat | null {
  if (!geo || typeof geo !== "object") return null;
  const g = geo as { lat?: unknown; lng?: unknown };
  const lat = typeof g.lat === "number" ? g.lat : Number(g.lat);
  const lng = typeof g.lng === "number" ? g.lng : Number(g.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Mean of a set of points — the fallback centroid for an area that has no
 * seeded `geo` but does have located listings.
 */
export function computeCentroid(points: LngLat[]): LngLat | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, p) => ({ lng: acc.lng + p.lng, lat: acc.lat + p.lat }),
    { lng: 0, lat: 0 },
  );
  return { lng: sum.lng / points.length, lat: sum.lat / points.length };
}

/** Editorial tag for the flyout, or null. */
export function areaTag(slug: string): string | null {
  return AREA_TAGS[slug] ?? null;
}

/**
 * Headline median AED/ft² for the flyout: apartments lead the AD market,
 * villa median as fallback (some clusters are villa-only). 0 / missing → null.
 */
export function pickMedianPerFt2(stats: {
  median_apt_aed_per_ft2?: number;
  median_villa_aed_per_ft2?: number;
}): number | null {
  const value =
    stats.median_apt_aed_per_ft2 || 0 || stats.median_villa_aed_per_ft2 || 0;
  return value > 0 ? value : null;
}

/**
 * Dot subtitle: "Studio · 640 ft²" / "2 bd · 1,180 ft²".
 *
 * Called from the client popup with the visitor's unit. The default keeps it
 * pure ft² for callers that have no preference to hand — and keeps the
 * existing specs honest.
 */
export function dotMeta(
  beds: number | null,
  builtUpFt2: number | null,
  unit: AreaUnit = "ft2",
): string {
  const bedsLabel = beds === 0 ? "Studio" : beds != null ? `${beds} bd` : null;
  const sizeLabel =
    builtUpFt2 && builtUpFt2 > 0 ? formatArea(builtUpFt2, unit) : null;
  return [bedsLabel, sizeLabel].filter(Boolean).join(" · ");
}

type PropertyDotRow = {
  slug: string;
  reference: string;
  geo: unknown;
  price_aed: number | string;
  title: string;
  beds: number | null;
  built_up_ft2: number | null;
};

/** Shape one published-property row into a map dot, or null if unlocated. */
export function shapeDot(row: PropertyDotRow): AreaDot | null {
  const g = parseGeo(row.geo);
  if (!g) return null;
  return {
    slug: row.slug,
    reference: row.reference,
    lng: g.lng,
    lat: g.lat,
    priceAed: Number(row.price_aed) || 0,
    title: row.title,
    beds: row.beds,
    builtUpFt2: row.built_up_ft2,
    metaText: null,
  };
}

/** median AED/ft² + YoY for an area, from the seed guides. */
function seedStatsForSlug(slug: string): {
  median: number | null;
  yoy: number | null;
} {
  const seed = SEED_AREA_GUIDES.find((s) => s.slug === slug);
  if (!seed) return { median: null, yoy: null };
  return {
    median: pickMedianPerFt2(seed.stats),
    yoy: seed.stats.yoy_change_pct || null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// listAreaPins
// ─────────────────────────────────────────────────────────────────────
export async function listAreaPins(
  emirate: string = DEFAULT_EMIRATE,
): Promise<AreaPin[]> {
  if (!isSupabaseConfigured) return seedAreaPins(emirate);
  try {
    const sb = createSupabasePublicClient();

    // Resolve the emirate row. No row (e.g. Dubai not seeded yet) → no
    // pins; the emirate toggle then shows a "coming soon" empty state.
    const { data: em } = await sb
      .from("areas")
      .select("id")
      .eq("kind", "emirate")
      .eq("slug", emirate)
      .maybeSingle();
    if (!em) return emirate === DEFAULT_EMIRATE ? seedAreaPins(emirate) : [];

    const { data: areas } = await sb
      .from("areas")
      .select("id, slug, name, name_ar, geo")
      .eq("kind", "area")
      .eq("parent_id", em.id)
      .order("name", { ascending: true });
    if (!areas || areas.length === 0) {
      return emirate === DEFAULT_EMIRATE ? seedAreaPins(emirate) : [];
    }

    // One roundtrip for every published listing in the emirate; we both
    // count them per area and keep their points for a centroid fallback.
    const ids = areas.map((a) => a.id);
    const { data: props } = await sb
      .from("properties")
      .select("area_id, geo")
      .eq("status", "published")
      .in("area_id", ids);

    // Pin labels are display; `slug` stays as authored — it keys
    // AREA_CENTROIDS, areaTag() and seedStatsForSlug(), and folding it would
    // silently drop every pin's centroid and stats on /ar.
    const pinLocale = await currentLocale();
    const countByArea = new Map<string, number>();
    const pointsByArea = new Map<string, LngLat[]>();
    for (const p of props ?? []) {
      const aid = p.area_id as string;
      if (!aid) continue;
      countByArea.set(aid, (countByArea.get(aid) ?? 0) + 1);
      const pt = parseGeo(p.geo);
      if (pt) {
        const arr = pointsByArea.get(aid) ?? [];
        arr.push(pt);
        pointsByArea.set(aid, arr);
      }
    }

    const pins: AreaPin[] = [];
    for (const a of areas) {
      const count = countByArea.get(a.id) ?? 0;
      // A pin advertises live inventory — skip areas with none.
      if (count === 0) continue;
      const centroid =
        parseGeo(a.geo) ??
        AREA_CENTROIDS[a.slug] ??
        computeCentroid(pointsByArea.get(a.id) ?? []);
      if (!centroid) continue; // nowhere to place it
      const { median, yoy } = seedStatsForSlug(a.slug);
      pins.push({
        id: a.id,
        slug: a.slug,
        name: (
          localiseRow(a as unknown as Record<string, unknown>, pinLocale) as {
            name: string;
          }
        ).name,
        emirate,
        tag: areaTag(a.slug),
        lng: centroid.lng,
        lat: centroid.lat,
        count,
        medianPerFt2: median,
        yoyChange: yoy,
      });
    }
    return pins;
  } catch {
    return seedAreaPins(emirate);
  }
}

// ─────────────────────────────────────────────────────────────────────
// listAreaListingDots
// ─────────────────────────────────────────────────────────────────────
export async function listAreaListingDots(
  opts: {
    emirate?: string;
    areaSlug?: string;
    /** Scope dots to one listing mode (e.g. "rent" for the /rent map). */
    mode?: "buy" | "rent" | "off_plan" | "commercial";
  } = {},
): Promise<AreaDot[]> {
  const { emirate = DEFAULT_EMIRATE, areaSlug, mode } = opts;
  if (!isSupabaseConfigured) return [];
  try {
    const sb = createSupabasePublicClient();

    // Scope to one area (detail page) or every area in the emirate (home).
    let areaIds: string[];
    if (areaSlug) {
      const { data: a } = await sb
        .from("areas")
        .select("id")
        .eq("slug", areaSlug)
        .maybeSingle();
      if (!a) return [];
      areaIds = [a.id];
    } else {
      const { data: em } = await sb
        .from("areas")
        .select("id")
        .eq("kind", "emirate")
        .eq("slug", emirate)
        .maybeSingle();
      if (!em) return [];
      const { data: areas } = await sb
        .from("areas")
        .select("id")
        .eq("kind", "area")
        .eq("parent_id", em.id);
      areaIds = (areas ?? []).map((a) => a.id);
      if (areaIds.length === 0) return [];
    }

    let query = sb
      .from("properties")
      .select("slug, reference, geo, price_aed, title, beds, built_up_ft2")
      .eq("status", "published")
      .in("area_id", areaIds)
      .not("geo", "is", null);
    if (mode) query = query.eq("mode", mode);
    const { data: props } = await query;

    const dots: AreaDot[] = [];
    for (const p of props ?? []) {
      const dot = shapeDot(p as PropertyDotRow);
      if (dot) dots.push(dot);
    }
    return dots;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// Seed fallback (Supabase unconfigured — local dev with no creds)
// ─────────────────────────────────────────────────────────────────────
function seedAreaPins(emirate: string): AreaPin[] {
  if (emirate !== DEFAULT_EMIRATE) return [];
  const pins: AreaPin[] = [];
  let i = 0;
  for (const [slug, centroid] of Object.entries(AREA_CENTROIDS)) {
    const seed = SEED_AREA_GUIDES.find((s) => s.slug === slug);
    if (!seed) continue;
    const { median, yoy } = seedStatsForSlug(slug);
    pins.push({
      id: `seed:${slug}`,
      slug,
      name: seed.name,
      emirate,
      tag: areaTag(slug),
      lng: centroid.lng,
      lat: centroid.lat,
      // Deterministic non-zero count so the offline map isn't blank.
      count: 4 + ((i * 7) % 17),
      medianPerFt2: median,
      yoyChange: yoy,
    });
    i += 1;
  }
  return pins;
}
