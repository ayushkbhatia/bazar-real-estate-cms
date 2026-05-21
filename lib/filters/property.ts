import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
import { PROPERTY_TYPES } from "@/lib/schemas/property";

/**
 * Parsers shared between the server page (via createSearchParamsCache) and
 * the client FilterBar (via useQueryStates). Defining them once keeps the
 * URL ↔ state contract consistent between the two surfaces.
 */
export const filterParsers = {
  q: parseAsString,
  beds: parseAsInteger,
  baths: parseAsInteger,
  type: parseAsStringEnum([...PROPERTY_TYPES]),
  price_min: parseAsInteger,
  price_max: parseAsInteger,
  area: parseAsString,
} as const;

export const propertyFilterCache = createSearchParamsCache(filterParsers);

export type PropertyFilters = {
  q: string | null;
  beds: number | null;
  baths: number | null;
  type: (typeof PROPERTY_TYPES)[number] | null;
  price_min: number | null;
  price_max: number | null;
  area: string | null;
};

const EMPTY: PropertyFilters = {
  q: null,
  beds: null,
  baths: null,
  type: null,
  price_min: null,
  price_max: null,
  area: null,
};

/** Coerce an unknown record (typically searchParams) to PropertyFilters. */
export function parseFilters(input: Record<string, unknown>): PropertyFilters {
  const out: PropertyFilters = { ...EMPTY };

  if (typeof input.q === "string") {
    const trimmed = input.q.trim();
    if (trimmed !== "") out.q = trimmed.slice(0, 200);
  }

  const beds = toInt(input.beds);
  if (beds != null && beds >= 0) out.beds = clamp(beds, 0, 50);

  const baths = toInt(input.baths);
  if (baths != null && baths >= 0) out.baths = clamp(baths, 0, 50);

  if (typeof input.type === "string" && (PROPERTY_TYPES as readonly string[]).includes(input.type)) {
    out.type = input.type as PropertyFilters["type"];
  }

  const min = toInt(input.price_min);
  if (min != null && min >= 0) out.price_min = min;

  const max = toInt(input.price_max);
  if (max != null && max >= 0) out.price_max = max;

  if (typeof input.area === "string" && input.area.trim() !== "") {
    out.area = input.area.trim();
  }

  return out;
}

/** How many filters are non-null. */
export function countActiveFilters(f: PropertyFilters): number {
  let n = 0;
  for (const v of Object.values(f)) {
    if (v !== null && v !== undefined && v !== "") n++;
  }
  return n;
}

/** A pretty single-line summary used in result-count strings. */
export function describeFilters(f: PropertyFilters, areaName?: string): string {
  const parts: string[] = [];
  if (f.q) parts.push(`"${f.q}"`);
  if (f.beds != null) parts.push(`${f.beds}+ beds`);
  if (f.baths != null) parts.push(`${f.baths}+ baths`);
  if (f.type) parts.push(humanType(f.type));
  if (areaName) parts.push(`in ${areaName}`);
  else if (f.area) parts.push(`in ${f.area}`);
  if (f.price_min != null || f.price_max != null) {
    const min = f.price_min != null ? `${(f.price_min / 1_000_000).toFixed(1)}M` : "0";
    const max = f.price_max != null ? `${(f.price_max / 1_000_000).toFixed(1)}M` : "∞";
    parts.push(`AED ${min}–${max}`);
  }
  return parts.join(" · ");
}

function humanType(t: PropertyFilters["type"]): string {
  switch (t) {
    case "apartment":
      return "Apartments";
    case "villa":
      return "Villas";
    case "penthouse":
      return "Penthouses";
    case "townhouse":
      return "Townhouses";
    case "commercial":
      return "Commercial";
    case "land":
      return "Land";
    case "hotel_apartment":
      return "Hotel apartments";
    default:
      return "";
  }
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
