/**
 * Sprint 12 — Mapbox helpers.
 *
 * Three things live here:
 *  - geocodeAddress(): forward geocoding for the valuation address
 *    typeahead. Returns place candidates with center coords.
 *  - reverseGeocode(): lat/lng → human address.
 *  - isochrone(): commute-time polygon for /buy → "30 min by car".
 *
 * All functions resolve to `null` when NEXT_PUBLIC_MAPBOX_TOKEN is
 * absent so callers can degrade to a plain text field / maplibre tiles
 * / a hidden commute tool without crashing.
 *
 * Costs (mid-2026): geocoding is $0.50/1k requests, directions $0.50/1k,
 * isochrone $2/1k. Free tier covers ~50k loads + 100k geocodes / month.
 */

import { env, isMapboxConfigured } from "@/lib/env";

const GEOCODE_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const ISOCHRONE_BASE = "https://api.mapbox.com/isochrone/v1/mapbox";

export type GeocodeFeature = {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number];
  context: { id: string; text: string }[];
};

/** Forward geocode `query` biased to UAE. Returns up to `limit` features.
 *  Resolves to [] when the token is absent. */
export async function geocodeAddress(
  query: string,
  opts: { limit?: number; proximity?: [number, number] } = {},
): Promise<GeocodeFeature[]> {
  if (!isMapboxConfigured || !env.NEXT_PUBLIC_MAPBOX_TOKEN) return [];
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    access_token: env.NEXT_PUBLIC_MAPBOX_TOKEN,
    country: "ae",
    limit: String(opts.limit ?? 5),
    language: "en",
    types: "address,poi,neighborhood,place",
  });
  if (opts.proximity) {
    params.set("proximity", `${opts.proximity[0]},${opts.proximity[1]}`);
  }
  const url = `${GEOCODE_BASE}/${encodeURIComponent(query)}.json?${params}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: GeocodeFeature[] };
    return json.features ?? [];
  } catch (e) {
    console.error("[mapbox geocode]", (e as Error).message);
    return [];
  }
}

/** Reverse geocode [lng, lat] → first matching feature. */
export async function reverseGeocode(
  coord: [number, number],
): Promise<GeocodeFeature | null> {
  if (!isMapboxConfigured || !env.NEXT_PUBLIC_MAPBOX_TOKEN) return null;
  const params = new URLSearchParams({
    access_token: env.NEXT_PUBLIC_MAPBOX_TOKEN,
    language: "en",
    limit: "1",
  });
  const url = `${GEOCODE_BASE}/${coord[0]},${coord[1]}.json?${params}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: GeocodeFeature[] };
    return json.features?.[0] ?? null;
  } catch {
    return null;
  }
}

export type IsochroneFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: { contour: number };
};

/** Build a drive-time / walk-time polygon. `contoursMinutes` accepts
 *  up to 4 values (e.g. [10, 20, 30]). Mode defaults to driving. */
export async function isochrone(
  center: [number, number],
  contoursMinutes: number[],
  profile: "driving" | "walking" | "cycling" = "driving",
): Promise<IsochroneFeature[] | null> {
  if (!isMapboxConfigured || !env.NEXT_PUBLIC_MAPBOX_TOKEN) return null;
  if (contoursMinutes.length === 0 || contoursMinutes.length > 4) return null;
  const params = new URLSearchParams({
    access_token: env.NEXT_PUBLIC_MAPBOX_TOKEN,
    contours_minutes: contoursMinutes.join(","),
    polygons: "true",
    denoise: "1",
  });
  const url =
    `${ISOCHRONE_BASE}/${profile}/${center[0]},${center[1]}?${params}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: IsochroneFeature[];
    };
    return json.features ?? null;
  } catch (e) {
    console.error("[mapbox isochrone]", (e as Error).message);
    return null;
  }
}

/** Format the Mapbox features array for an autocomplete dropdown. */
export function formatGeocodeFeatures(
  features: GeocodeFeature[],
): { id: string; label: string; sub: string; center: [number, number] }[] {
  return features.map((f) => ({
    id: f.id,
    label: f.text,
    sub: f.place_name,
    center: f.center,
  }));
}
