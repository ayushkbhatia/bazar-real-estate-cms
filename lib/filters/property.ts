import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  parseAsBoolean,
} from "nuqs/server";
import { PROPERTY_FORMS, PROPERTY_TYPES } from "@/lib/schemas/property";

export const TENURES = ["freehold", "leasehold"] as const;
export const FURNISHINGS = ["unfurnished", "semi", "fully"] as const;
export const SORT_OPTIONS = [
  "recent",
  "price_asc",
  "price_desc",
  "area_desc",
] as const;

/**
 * Parsers shared between the server page (via createSearchParamsCache) and
 * the client FilterBar (via useQueryStates). Defining them once keeps the
 * URL ↔ state contract consistent between the two surfaces.
 *
 * Sprint 4b: ft²/year-built/tenure/furnishing/amenities/verified/advisor/
 * sort/page added to lift facet coverage to the design's 15.
 */
export const filterParsers = {
  q: parseAsString,
  beds: parseAsInteger,
  baths: parseAsInteger,
  type: parseAsStringEnum([...PROPERTY_TYPES]),
  /** Completion form — off-plan / ready (new) / resale. Only meaningful on the
   *  sale surfaces; /buy/ready and /buy/resale set it from the route instead,
   *  and SearchList ignores it outside mode = buy. */
  form: parseAsStringEnum([...PROPERTY_FORMS]),
  price_min: parseAsInteger,
  price_max: parseAsInteger,
  area: parseAsString,
  ft2_min: parseAsInteger,
  ft2_max: parseAsInteger,
  year_min: parseAsInteger,
  year_max: parseAsInteger,
  tenure: parseAsStringEnum([...TENURES]),
  furnishing: parseAsStringEnum([...FURNISHINGS]),
  amenities: parseAsString, // comma-separated list, parsed below
  verified: parseAsBoolean,
  advisor: parseAsString, // staff slug
  sort: parseAsStringEnum([...SORT_OPTIONS]),
  page: parseAsInteger,
} as const;

export const propertyFilterCache = createSearchParamsCache(filterParsers);

export type Tenure = (typeof TENURES)[number];
export type Furnishing = (typeof FURNISHINGS)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];

export type PropertyFilters = {
  q: string | null;
  beds: number | null;
  baths: number | null;
  type: (typeof PROPERTY_TYPES)[number] | null;
  form: (typeof PROPERTY_FORMS)[number] | null;
  price_min: number | null;
  price_max: number | null;
  area: string | null;
  ft2_min: number | null;
  ft2_max: number | null;
  year_min: number | null;
  year_max: number | null;
  tenure: Tenure | null;
  furnishing: Furnishing | null;
  amenities: string[];
  verified: boolean | null;
  advisor: string | null;
  sort: SortOption | null;
  page: number | null;
};

const EMPTY: PropertyFilters = {
  q: null,
  beds: null,
  baths: null,
  type: null,
  form: null,
  price_min: null,
  price_max: null,
  area: null,
  ft2_min: null,
  ft2_max: null,
  year_min: null,
  year_max: null,
  tenure: null,
  furnishing: null,
  amenities: [],
  verified: null,
  advisor: null,
  sort: null,
  page: null,
};

export const PAGE_SIZE = 24;

/** Coerce an unknown record (typically searchParams) to PropertyFilters. */
export function parseFilters(input: Record<string, unknown>): PropertyFilters {
  const out: PropertyFilters = { ...EMPTY, amenities: [] };

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

  if (
    typeof input.form === "string" &&
    (PROPERTY_FORMS as readonly string[]).includes(input.form)
  ) {
    out.form = input.form as PropertyFilters["form"];
  }

  const min = toInt(input.price_min);
  if (min != null && min >= 0) out.price_min = min;

  const max = toInt(input.price_max);
  if (max != null && max >= 0) out.price_max = max;

  if (typeof input.area === "string" && input.area.trim() !== "") {
    out.area = input.area.trim();
  }

  const ft2min = toInt(input.ft2_min);
  if (ft2min != null && ft2min >= 0) out.ft2_min = ft2min;
  const ft2max = toInt(input.ft2_max);
  if (ft2max != null && ft2max >= 0) out.ft2_max = ft2max;

  const yrmin = toInt(input.year_min);
  if (yrmin != null && yrmin >= 1900) out.year_min = yrmin;
  const yrmax = toInt(input.year_max);
  if (yrmax != null && yrmax >= 1900) out.year_max = yrmax;

  if (
    typeof input.tenure === "string" &&
    (TENURES as readonly string[]).includes(input.tenure)
  ) {
    out.tenure = input.tenure as Tenure;
  }
  if (
    typeof input.furnishing === "string" &&
    (FURNISHINGS as readonly string[]).includes(input.furnishing)
  ) {
    out.furnishing = input.furnishing as Furnishing;
  }

  if (typeof input.amenities === "string" && input.amenities.trim() !== "") {
    out.amenities = input.amenities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
  } else if (Array.isArray(input.amenities)) {
    out.amenities = input.amenities
      .filter((s): s is string => typeof s === "string" && s.trim() !== "")
      .slice(0, 30);
  }

  if (input.verified === true || input.verified === "true") {
    out.verified = true;
  }

  if (typeof input.advisor === "string" && input.advisor.trim() !== "") {
    out.advisor = input.advisor.trim();
  }

  if (
    typeof input.sort === "string" &&
    (SORT_OPTIONS as readonly string[]).includes(input.sort)
  ) {
    out.sort = input.sort as SortOption;
  }

  const pg = toInt(input.page);
  if (pg != null && pg >= 1) out.page = pg;

  return out;
}

/** How many filters are non-null. Pagination + sort don't count as
 * "active filters" — they're presentation, not narrowing. */
const NON_COUNTING_KEYS = new Set(["sort", "page"]);

export function countActiveFilters(f: PropertyFilters): number {
  let n = 0;
  for (const [k, v] of Object.entries(f)) {
    if (NON_COUNTING_KEYS.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    n++;
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
  if (f.form) parts.push(humanForm(f.form));
  if (areaName) parts.push(`in ${areaName}`);
  else if (f.area) parts.push(`in ${f.area}`);
  if (f.price_min != null || f.price_max != null) {
    const min = f.price_min != null ? `${(f.price_min / 1_000_000).toFixed(1)}M` : "0";
    const max = f.price_max != null ? `${(f.price_max / 1_000_000).toFixed(1)}M` : "∞";
    parts.push(`AED ${min}–${max}`);
  }
  return parts.join(" · ");
}

function humanForm(f: NonNullable<PropertyFilters["form"]>): string {
  switch (f) {
    case "off_plan":
      return "Off-plan";
    case "ready_new":
      return "Ready (new)";
    case "resale":
      return "Resale";
  }
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
