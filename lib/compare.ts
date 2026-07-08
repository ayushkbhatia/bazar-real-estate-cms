/**
 * Pure helpers for the compare tool. No React, no DB. The Postgres-shaped
 * `ComparableProperty` is the only type leaking in from the query layer;
 * everything below operates on plain values so the tests can drive it with
 * literals.
 */

import type { ComparableProperty } from "@/lib/queries/compare";

export type CellValue = string | number | boolean | null;

export type AttributeRow = {
  key: string;
  label: string;
  /** One cell per property, in the same order as the input. */
  values: CellValue[];
  /** When true, the row is rendered with diff-highlight backgrounds. */
  differs: boolean;
};

export type AttributeGroup = {
  key: string;
  label: string;
  rows: AttributeRow[];
};

/* ────────────────────────────────────────────────────────────────
 * Formatting
 * ───────────────────────────────────────────────────────────────*/

export function formatAed(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toLocaleString()}`;
}

export function formatFt2(n: number | null): string {
  if (n == null) return "—";
  return `${n.toLocaleString()} ft²`;
}

export function modeLabel(mode: ComparableProperty["mode"]): string {
  switch (mode) {
    case "buy":
      return "Buy · resale";
    case "rent":
      return "Rent";
    case "off_plan":
      return "Off-plan";
    case "commercial":
      return "Commercial";
  }
}

export function typeLabel(t: ComparableProperty["type"]): string {
  switch (t) {
    case "apartment":
      return "Apartment";
    case "villa":
      return "Villa";
    case "penthouse":
      return "Penthouse";
    case "townhouse":
      return "Townhouse";
    case "commercial":
      return "Commercial";
    case "land":
      return "Land";
    case "hotel_apartment":
      return "Hotel apartment";
    case "office":
      return "Office";
    case "building":
      return "Building";
    case "retail":
      return "Retail";
    case "commercial_villa":
      return "Commercial villa";
  }
}

export function tenureLabel(
  t: ComparableProperty["tenure"],
): string | null {
  if (!t) return null;
  return t === "freehold"
    ? "Freehold"
    : t === "leasehold"
      ? "Leasehold"
      : "Usufruct";
}

export function furnishingLabel(
  f: ComparableProperty["furnishing"],
): string | null {
  if (!f) return null;
  return f === "unfurnished"
    ? "Unfurnished"
    : f === "semi"
      ? "Semi-furnished"
      : "Fully furnished";
}

/** Days since publication. */
export function listedDays(
  publishedIso: string | null,
  nowMs: number,
): string {
  if (!publishedIso) return "—";
  const ms = nowMs - new Date(publishedIso).getTime();
  const d = Math.floor(ms / (24 * 60 * 60_000));
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return `${Math.floor(d / 365)} yr ago`;
}

/* ────────────────────────────────────────────────────────────────
 * Diff detection
 * ───────────────────────────────────────────────────────────────*/

/** True iff the values (other than null) are not all equal. */
export function rowDiffers(values: CellValue[]): boolean {
  const non = values.filter((v) => v !== null);
  if (non.length <= 1) return false;
  const first = non[0];
  return non.some((v) => v !== first);
}

/* ────────────────────────────────────────────────────────────────
 * Row builders
 * ───────────────────────────────────────────────────────────────*/

function row(
  key: string,
  label: string,
  values: CellValue[],
): AttributeRow {
  return { key, label, values, differs: rowDiffers(values) };
}

function map<T>(
  rows: ComparableProperty[],
  fn: (r: ComparableProperty) => T,
): T[] {
  return rows.map(fn);
}

function pricePerFt2(p: ComparableProperty): number | null {
  if (!p.built_up_ft2 || p.built_up_ft2 <= 0) return null;
  return Math.round(p.price_aed / p.built_up_ft2);
}

function priceAndTermsGroup(
  rows: ComparableProperty[],
  nowMs: number,
): AttributeGroup {
  return {
    key: "price_terms",
    label: "Price & terms",
    rows: [
      row(
        "asking_price",
        "Asking price",
        map(rows, (p) => formatAed(p.price_aed)),
      ),
      row(
        "ppf",
        "Price per ft²",
        map(rows, (p) => {
          const v = pricePerFt2(p);
          return v == null ? null : `AED ${v.toLocaleString()}`;
        }),
      ),
      row("mode", "Mode", map(rows, (p) => modeLabel(p.mode))),
      row(
        "tenure",
        "Tenure",
        map(rows, (p) => tenureLabel(p.tenure) ?? "—"),
      ),
      row(
        "service_charge",
        "Service charge",
        map(rows, (p) =>
          p.service_charge_per_ft2 == null
            ? "—"
            : `AED ${p.service_charge_per_ft2}/ft²/yr`,
        ),
      ),
      row(
        "listed",
        "Listed",
        map(rows, (p) => listedDays(p.published_at, nowMs)),
      ),
    ],
  };
}

function specificationsGroup(rows: ComparableProperty[]): AttributeGroup {
  return {
    key: "specifications",
    label: "Specifications",
    rows: [
      row("type", "Type", map(rows, (p) => typeLabel(p.type))),
      row("beds", "Bedrooms", map(rows, (p) => p.beds)),
      row("baths", "Bathrooms", map(rows, (p) => p.baths)),
      row(
        "built_up",
        "Area (built-up)",
        map(rows, (p) => formatFt2(p.built_up_ft2)),
      ),
      row("plot", "Plot area", map(rows, (p) => formatFt2(p.plot_ft2))),
      row(
        "floor",
        "Floor",
        map(rows, (p) =>
          p.floor == null ? "—" : `Floor ${p.floor}`,
        ),
      ),
      row(
        "year_built",
        "Year built",
        map(rows, (p) => p.year_built ?? "—"),
      ),
      row(
        "parking",
        "Parking bays",
        map(rows, (p) => p.parking_bays ?? "—"),
      ),
      row(
        "furnishing",
        "Furnishing",
        map(rows, (p) => furnishingLabel(p.furnishing) ?? "—"),
      ),
      row(
        "view",
        "View",
        map(rows, (p) => p.view ?? "—"),
      ),
    ],
  };
}

function locationGroup(rows: ComparableProperty[]): AttributeGroup {
  return {
    key: "location",
    label: "Location",
    rows: [
      row(
        "area",
        "Neighborhood",
        map(rows, (p) => p.area_name ?? "—"),
      ),
    ],
  };
}

/**
 * Amenities group — union all amenities across the comparison set, then
 * surface one row per amenity. Designed for boolean comparison: each cell
 * is `true` if the property includes that amenity, `false` otherwise.
 *
 * Capped at 12 amenities (sorted alphabetically). If the comparison has
 * fewer, we still emit a single "Amenities" row stating how many each has,
 * so the group is never empty.
 */
function amenitiesGroup(rows: ComparableProperty[]): AttributeGroup {
  const all = unionAmenities(rows);
  if (all.length === 0) {
    return {
      key: "amenities",
      label: "Amenities",
      rows: [
        row(
          "amenity_count",
          "Listed amenities",
          map(rows, (p) => p.amenities.length),
        ),
      ],
    };
  }
  return {
    key: "amenities",
    label: "Amenities",
    rows: all.slice(0, 12).map((amenity) =>
      row(
        `amenity::${amenity.toLowerCase()}`,
        amenity,
        map(rows, (p) =>
          p.amenities.some((a) => sameAmenity(a, amenity)),
        ),
      ),
    ),
  };
}

function investmentGroup(rows: ComparableProperty[]): AttributeGroup {
  return {
    key: "investment",
    label: "Investment",
    rows: [
      row(
        "exclusive",
        "Bazar exclusive",
        map(rows, (p) => Boolean(p.flags?.exclusive)),
      ),
      row(
        "vacant_on_transfer",
        "Vacant on transfer",
        map(rows, (p) => Boolean(p.flags?.vacant_on_transfer)),
      ),
      row(
        "mortgage_eligible",
        "Mortgageable now",
        map(rows, (p) =>
          // Off-plan: assume not mortgageable yet unless explicitly flagged.
          p.mode === "off_plan"
            ? Boolean(p.flags?.mortgage_eligible)
            : p.flags?.mortgage_eligible !== false,
        ),
      ),
    ],
  };
}

/** Case-insensitive comparison so "Private pool" and "private pool" align. */
function sameAmenity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Build a sorted unique set of amenities across all rows. */
export function unionAmenities(rows: ComparableProperty[]): string[] {
  const seen = new Map<string, string>(); // lowercased → first-seen label
  for (const p of rows) {
    for (const a of p.amenities) {
      const key = a.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, a.trim());
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

/* ────────────────────────────────────────────────────────────────
 * Entry point
 * ───────────────────────────────────────────────────────────────*/

export function buildAttributeGroups(
  rows: ComparableProperty[],
  nowMs: number = Date.now(),
): AttributeGroup[] {
  if (rows.length === 0) return [];
  return [
    priceAndTermsGroup(rows, nowMs),
    specificationsGroup(rows),
    locationGroup(rows),
    amenitiesGroup(rows),
    investmentGroup(rows),
  ];
}
