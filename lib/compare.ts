/**
 * Pure helpers for the compare tool. No React, no DB. The Postgres-shaped
 * `ComparableProperty` is the only type leaking in from the query layer;
 * everything below operates on plain values so the tests can drive it with
 * literals.
 */

import type { ComparableProperty } from "@/lib/queries/compare";

/**
 * A cell whose value is money or an area, tagged with the unit it is stored
 * in rather than rendered into a string here.
 *
 * The compare table is built on the server; the visitor's currency and area
 * unit are only readable on the client. So these travel as raw AED / ft²
 * numbers and `renderCell` in the page hands them to the leaves in
 * `_components/area-text`.
 */
export type UnitCell =
  | { kind: "aed"; value: number | null }
  | { kind: "ft2"; value: number | null }
  | { kind: "aedPerFt2"; value: number | null; per?: "yr" };

/**
 * A cell whose text is a message key rather than words.
 *
 * The mode, the tenure, the furnishing and the type are enums, and this module
 * used to turn each into English prose — the only strings in a file whose
 * header says "pure helpers, no React, no DB". `renderCell` resolves the key
 * against the catalogue instead, so the model stays arithmetic and taxonomy.
 */
export type MsgCell = {
  kind: "msg";
  key: string;
  /** ICU `count`, for the two keys that are plurals — floor and listed-ago. */
  count?: number;
};

export type CellValue =
  | string
  | number
  | boolean
  | null
  | UnitCell
  | MsgCell;

/** The comparable number inside a cell, for diffing. */
function cellKey(v: CellValue): string | number | boolean | null {
  if (v === null || typeof v !== "object") return v;
  // A message cell diffs on its key, which is the enum — comparing rendered
  // text would make the highlighting depend on the visitor's language, the
  // same way comparing formatted money made it depend on their currency.
  return v.kind === "msg"
    ? `${v.key}${v.count === undefined ? "" : `:${v.count}`}`
    : v.value;
}

export type AttributeRow = {
  /** Stable key — the React list key, and the message key for the row name. */
  key: string;
  /**
   * The row's name, when it is **data** rather than copy.
   *
   * Every row here is named by the catalogue via `key` — except an amenity
   * row, whose name is an amenity string out of the database. That one gets
   * its Arabic from the DB read fold, not from `messages/`, so it travels as
   * text and the renderer prints it verbatim.
   */
  dataLabel?: string;
  /** One cell per property, in the same order as the input. */
  values: CellValue[];
  /** When true, the row is rendered with diff-highlight backgrounds. */
  differs: boolean;
};

export type AttributeGroup = {
  key: string;
  rows: AttributeRow[];
};

/* ────────────────────────────────────────────────────────────────
 * Formatting
 * ───────────────────────────────────────────────────────────────*/

/*
 * `modeLabel`, `typeLabel`, `tenureLabel` and `furnishingLabel` used to live
 * here, each a switch returning English. They are enums, so the enum value is
 * the message key and the switch was pure ceremony — the row now emits
 * `{ kind: "msg", key: "mode.buy" }` and the page resolves it.
 */

/** A cell naming an enum, resolved against the catalogue at render time. */
function msg(key: string, count?: number): MsgCell {
  return count === undefined ? { kind: "msg", key } : { kind: "msg", key, count };
}

/**
 * How long ago a listing was published, as a unit and a count.
 *
 * It used to return the sentence — "today", "1 day ago", "5 mo ago" — which
 * cannot be translated: Arabic has six plural categories and this had two, so
 * "3 days ago" and "11 days ago" take different nouns. Returning the pair lets
 * the caller pick an ICU message per unit and get all six.
 */
export type ListedAge =
  | { unit: "day" | "month" | "year"; n: number }
  | null;

export function listedAge(
  publishedIso: string | null,
  nowMs: number,
): ListedAge {
  if (!publishedIso) return null;
  const ms = nowMs - new Date(publishedIso).getTime();
  const d = Math.max(0, Math.floor(ms / (24 * 60 * 60_000)));
  if (d < 30) return { unit: "day", n: d };
  if (d < 365) return { unit: "month", n: Math.floor(d / 30) };
  return { unit: "year", n: Math.floor(d / 365) };
}

/* ────────────────────────────────────────────────────────────────
 * Diff detection
 * ───────────────────────────────────────────────────────────────*/

/**
 * True iff the values (other than null) are not all equal.
 *
 * Diffs the raw number inside a `UnitCell`, never its rendered text. Comparing
 * formatted strings meant two listings at 4,201,000 and 4,204,000 AED both
 * read "AED 4.20M" and the row was wrongly marked identical — and it would
 * have made the highlighting depend on the visitor's currency.
 */
export function rowDiffers(values: CellValue[]): boolean {
  const non = values.map(cellKey).filter((v) => v !== null);
  if (non.length <= 1) return false;
  const first = non[0];
  return non.some((v) => v !== first);
}

/* ────────────────────────────────────────────────────────────────
 * Row builders
 * ───────────────────────────────────────────────────────────────*/

function row(key: string, values: CellValue[]): AttributeRow {
  return { key, values, differs: rowDiffers(values) };
}

/** An amenity row, whose name comes from the database rather than a message. */
function dataRow(
  key: string,
  dataLabel: string,
  values: CellValue[],
): AttributeRow {
  return { key, dataLabel, values, differs: rowDiffers(values) };
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
    rows: [
      row(
        "asking_price",
        map(rows, (p) => ({ kind: "aed", value: p.price_aed })),
      ),
      // "per area", not "per ft²" — the unit is the visitor's to choose, and
      // the cell renders it.
      row(
        "ppf",
        map(rows, (p) => ({ kind: "aedPerFt2", value: pricePerFt2(p) })),
      ),
      row("mode", map(rows, (p) => msg(`mode.${p.mode}`))),
      row(
        "tenure",
        map(rows, (p) => (p.tenure ? msg(`tenure.${p.tenure}`) : null)),
      ),
      row(
        "service_charge",
        map(rows, (p) => ({
          kind: "aedPerFt2",
          value: p.service_charge_per_ft2,
          per: "yr",
        })),
      ),
      row(
        "listed",
        map(rows, (p) => {
          const age = listedAge(p.published_at, nowMs);
          return age ? msg(`listed.${age.unit}`, age.n) : null;
        }),
      ),
    ],
  };
}

function specificationsGroup(rows: ComparableProperty[]): AttributeGroup {
  return {
    key: "specifications",
    rows: [
      row("type", map(rows, (p) => msg(`type.${p.type}`))),
      row("beds", map(rows, (p) => p.beds)),
      row("baths", map(rows, (p) => p.baths)),
      row(
        "built_up",
        map(rows, (p) => ({ kind: "ft2", value: p.built_up_ft2 })),
      ),
      row("plot", map(rows, (p) => ({ kind: "ft2", value: p.plot_ft2 }))),
      // The floor NUMBER travels; the word "Floor" is the caller's. Returning
      // `Floor 7` here put a translatable noun inside a diffing key, so two
      // properties on the same floor compared as equal only by accident of
      // spelling.
      row(
        "floor",
        map(rows, (p) => (p.floor == null ? null : msg("floorValue", p.floor))),
      ),
      row("year_built", map(rows, (p) => p.year_built ?? null)),
      row("parking", map(rows, (p) => p.parking_bays ?? null)),
      row(
        "furnishing",
        map(rows, (p) =>
          p.furnishing ? msg(`furnishing.${p.furnishing}`) : null,
        ),
      ),
      row("view", map(rows, (p) => p.view ?? null)),
    ],
  };
}

function locationGroup(rows: ComparableProperty[]): AttributeGroup {
  return {
    key: "location",
    rows: [row("area", map(rows, (p) => p.area_name ?? null))],
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
      rows: [
        row("amenity_count", map(rows, (p) => p.amenities.length)),
      ],
    };
  }
  return {
    key: "amenities",
    rows: all.slice(0, 12).map((amenity) =>
      dataRow(
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
    rows: [
      row(
        "exclusive",
        map(rows, (p) => Boolean(p.flags?.exclusive)),
      ),
      row(
        "vacant_on_transfer",
        map(rows, (p) => Boolean(p.flags?.vacant_on_transfer)),
      ),
      row(
        "mortgage_eligible",
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
