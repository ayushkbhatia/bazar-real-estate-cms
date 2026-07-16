/**
 * Off-plan map data — turns the published developments into the three
 * serialisable shapes the New Projects map section needs:
 *
 *   · pins   → one AreaPin per area that has ≥1 published project
 *              (count = number of projects, placed at the area centroid)
 *   · dots   → one AreaDot per project, fanned out on a small ring around
 *              its area centroid so co-located projects don't stack
 *   · groups → the same projects grouped by area (sorted), for the cards
 *              listed underneath the map
 *
 * This is a PURE transform of the rows already fetched by
 * `listPublishedDevelopments()` — no extra Supabase round-trip and no
 * dependency on a per-development `geo` column (the developments table has
 * none; a project is located via its area). Reusing the same hand-verified
 * area centroids as the home map keeps the two surfaces in lockstep.
 */

import { areaTag, type AreaPin, type AreaDot } from "@/lib/queries/area-map";
import type { DevelopmentIndexRow } from "@/lib/queries/developments";
import { formatStartingPrice } from "@/lib/schemas/development";

const EMIRATE = "abu-dhabi";

// Hand-verified Abu Dhabi area centroids — mirrors AREA_CENTROIDS in
// lib/queries/area-map.ts (and 0039_area_geo_centroids.sql). Keep in
// lockstep; a project whose area is missing here is dropped from the map
// (it still appears in the featured list on the page).
const AREA_CENTROIDS: Record<string, { lng: number; lat: number }> = {
  "saadiyat-island": { lng: 54.435, lat: 24.545 },
  "yas-island": { lng: 54.605, lat: 24.488 },
  "al-reem-island": { lng: 54.404, lat: 24.5 },
  "al-maryah": { lng: 54.386, lat: 24.499 },
  adgm: { lng: 54.382, lat: 24.503 },
  "al-raha": { lng: 54.606, lat: 24.452 },
  corniche: { lng: 54.349, lat: 24.476 },
  "khalifa-city": { lng: 54.578, lat: 24.42 },
  "masdar-city": { lng: 54.617, lat: 24.427 },
  "hudayriyat-island": { lng: 54.3, lat: 24.44 },
  kizad: { lng: 54.683, lat: 24.717 },
  mussafah: { lng: 54.494, lat: 24.35 },
  "nurai-island": { lng: 54.47, lat: 24.59 },
};

// Ring radius (degrees) for fanning co-located projects apart. ~0.011° ≈
// 1.2km — wide enough to separate dots once an island is zoomed in, small
// enough to stay inside the area.
const RING_RADIUS = 0.011;

export type OffplanAreaGroup = {
  slug: string;
  name: string;
  count: number;
  projects: DevelopmentIndexRow[];
};

export type OffplanProjectOption = {
  id: string;
  name: string;
  areaName: string | null;
};

export type OffplanMapData = {
  pins: AreaPin[];
  dots: AreaDot[];
  groups: OffplanAreaGroup[];
  /** Flat list for the lead-form project picker. */
  options: OffplanProjectOption[];
};

/**
 * Position `n` points evenly around a centroid. A single project sits dead
 * centre; multiples fan onto a ring so their dots stay individually
 * clickable at the dot-reveal zoom. Deterministic (angle from index) so the
 * layout is stable across renders — no Math.random (SSR-safe).
 */
function ringPoint(
  centroid: { lng: number; lat: number },
  index: number,
  total: number,
): { lng: number; lat: number } {
  if (total <= 1) return centroid;
  const angle = (index / total) * Math.PI * 2;
  return {
    lng: centroid.lng + Math.cos(angle) * RING_RADIUS,
    // Latitude ring is squeezed a touch so the fan reads circular on screen.
    lat: centroid.lat + Math.sin(angle) * RING_RADIUS * 0.7,
  };
}

export function buildOffplanMap(
  developments: DevelopmentIndexRow[],
): OffplanMapData {
  // Group projects by area slug, preserving input order (published_at desc).
  const byArea = new Map<
    string,
    { name: string; projects: DevelopmentIndexRow[] }
  >();
  for (const d of developments) {
    const slug = d.area?.slug;
    if (!slug) continue; // no area → can't place it on the map
    const bucket = byArea.get(slug);
    if (bucket) bucket.projects.push(d);
    else byArea.set(slug, { name: d.area!.name, projects: [d] });
  }

  const pins: AreaPin[] = [];
  const dots: AreaDot[] = [];
  const groups: OffplanAreaGroup[] = [];

  for (const [slug, { name, projects }] of byArea) {
    const centroid = AREA_CENTROIDS[slug];
    if (!centroid) continue; // unknown centroid → skip on the map

    pins.push({
      id: `offplan-area:${slug}`,
      slug,
      name,
      emirate: EMIRATE,
      tag: areaTag(slug),
      lng: centroid.lng,
      lat: centroid.lat,
      count: projects.length,
      // Price stats aren't meaningful for a project count — leave blank.
      medianPerFt2: null,
      yoyChange: null,
    });

    projects.forEach((d, i) => {
      const pt = ringPoint(centroid, i, projects.length);
      dots.push({
        slug: d.slug,
        reference: d.slug,
        lng: pt.lng,
        lat: pt.lat,
        price: d.starting_price != null ? formatStartingPrice(d.starting_price) : "Price on request",
        priceAed: d.starting_price ?? 0,
        title: d.name,
        meta: d.developer ? `${d.developer.name} · ${name}` : name,
      });
    });

    groups.push({ slug, name, count: projects.length, projects });
  }

  // Busiest areas first, then alphabetical — matches how the pins read.
  groups.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const options: OffplanProjectOption[] = developments.map((d) => ({
    id: d.id,
    name: d.name,
    areaName: d.area?.name ?? null,
  }));

  return { pins, dots, groups, options };
}
