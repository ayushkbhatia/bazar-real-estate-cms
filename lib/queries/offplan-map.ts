/**
 * Off-plan map data — turns the published developments into the three
 * serialisable shapes the New Projects map section needs:
 *
 *   · pins   → one AreaPin per area that has ≥1 placeable published project
 *              (count = number of projects, placed at the mean of its dots)
 *   · dots   → one AreaDot per project, at the pin dropped on the project in
 *              the CMS (`meta.coords`) when it has one; otherwise fanned out
 *              on a small ring around its area centroid so co-located
 *              projects don't stack
 *   · groups → the same projects grouped by area (sorted), for the cards
 *              listed underneath the map
 *
 * This is a PURE transform: the rows come from `listPublishedDevelopments()`
 * and the per-project pins from `getDevelopmentCoordsBulk()` — the caller
 * fetches both. A project's own pin is the truth when set; the hand-verified
 * area centroids (shared with the home map) are only the fallback for a
 * project nobody has placed yet.
 */

import { areaTag, type AreaPin, type AreaDot } from "@/lib/queries/area-map";
import type { DevelopmentIndexRow } from "@/lib/queries/developments";

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

/**
 * Per-development pin, keyed by development id — the shape
 * `getDevelopmentCoordsBulk()` returns. A `null` (or a missing key) means the
 * project has no pin in the CMS and falls back to its area centroid.
 */
export type OffplanCoordsById = Record<
  string,
  { lat: number; lng: number } | null | undefined
>;

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

/** A CMS pin is only usable if it's two finite numbers in range. */
function validPin(
  c: { lat: number; lng: number } | null | undefined,
): { lat: number; lng: number } | null {
  if (!c) return null;
  const { lat, lng } = c;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function buildOffplanMap(
  developments: DevelopmentIndexRow[],
  /**
   * Pins dropped on each project in the CMS (Pages → Developments → Location).
   * Omit and every project falls back to the area-centroid ring, which is what
   * the map did before projects could be placed individually.
   */
  coordsById: OffplanCoordsById = {},
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

    // Projects the CMS has placed sit exactly where they were pinned; the rest
    // fan out on the area's ring. The ring is sized to the un-pinned projects
    // only, so it stays evenly spaced as projects get placed one by one.
    const pinned = projects.map((d) => validPin(coordsById[d.id]));
    const unplacedCount = pinned.filter((p) => p === null).length;

    // Nothing to draw: no project pin and no centroid to fall back to.
    if (unplacedCount === projects.length && !centroid) continue;

    const areaDots: AreaDot[] = [];
    let ringIndex = 0;
    projects.forEach((d, i) => {
      const own = pinned[i];
      // An un-pinned project in an area with no centroid can't be placed at
      // all — it still gets a card in the rail below the map, just no dot.
      if (!own && !centroid) return;
      const pt = own
        ? { lng: own.lng, lat: own.lat }
        : ringPoint(centroid!, ringIndex++, unplacedCount);
      areaDots.push({
        slug: d.slug,
        reference: d.slug,
        lng: pt.lng,
        lat: pt.lat,
        priceAed: d.starting_price ?? 0,
        title: d.name,
        // A development has no single bed count or built-up area, so it
        // supplies its own subtitle. No units in it, so nothing to convert.
        beds: null,
        builtUpFt2: null,
        metaText: d.developer ? `${d.developer.name} · ${name}` : name,
      });
    });

    // The area pin sits at the mean of its projects' dots, so the bubble lands
    // on the cluster it counts. With nothing pinned the ring is symmetric and
    // the mean is the centroid — i.e. exactly where the pin used to sit.
    const anchor = areaDots.reduce(
      (acc, d) => ({
        lng: acc.lng + d.lng / areaDots.length,
        lat: acc.lat + d.lat / areaDots.length,
      }),
      { lng: 0, lat: 0 },
    );

    pins.push({
      id: `offplan-area:${slug}`,
      slug,
      name,
      emirate: EMIRATE,
      tag: areaTag(slug),
      lng: anchor.lng,
      lat: anchor.lat,
      count: projects.length,
      // Price stats aren't meaningful for a project count — leave blank.
      medianPerFt2: null,
      yoyChange: null,
    });
    dots.push(...areaDots);

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

/**
 * How many cards an area's rail should hold, read from the "Projects per area"
 * field on the New Projects master page.
 *
 * The field is free text because the master-page editor has no number kind, so
 * anything that isn't a positive whole number — blank, "0", "twelve", "-3" —
 * means "no cap" rather than an empty rail. `count` on the group stays the
 * true total either way, so an area capped at 12 still reads "30 projects" and
 * still links out to the rest.
 */
export function parseGroupLimit(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
