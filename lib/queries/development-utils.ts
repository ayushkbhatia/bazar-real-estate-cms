/**
 * Pure, server-agnostic development helpers. Safe to import from Client
 * Components — no `next/headers`, no Supabase server client.
 */

import type { Database } from "@/db/types";

type UnitStatus = Database["public"]["Enums"]["development_unit_status"];

export type DevelopmentUnit = {
  id: string;
  unit_type: string;
  beds: number | null;
  built_up_ft2: number | null;
  plot_ft2: number | null;
  lagoon_access: string | null;
  orientation: string | null;
  price_aed: number | null;
  plot_number: string | null;
  status: UnitStatus;
  floor_plan_id: string | null;
  /**
   * Which filter chips this unit answers to, decided once at read time from
   * the **English** row. See `classifyUnit` for why it isn't decided here.
   */
  categories: UnitCategory[];
};

/** Group units by lagoon-access category — used by the filter chips on
 *  the detail page (All / Villas / Townhouses / Lagoon access). */
export type UnitFilter = "all" | "villas" | "townhouses" | "lagoon";

/** Every `UnitFilter` except `all`, which is not a classification. */
export type UnitCategory = Exclude<UnitFilter, "all">;

/**
 * Decide which chips a unit belongs under, from its English type and lagoon
 * wording.
 *
 * This has to run **before** the Arabic fold, and that is the whole reason it
 * is a separate function rather than the body of `filterUnits`. The rules are
 * English word matches — `/villa/i`, `/town|terrace/i`, `/walking/i` — so a
 * row whose `unit_type` has been replaced with `فيلا` matches none of them.
 * The chips would not error; they would read `Villas · 0` on `/ar` while the
 * table below showed four villas, which is the kind of wrong that survives a
 * review.
 *
 * So `listDevelopmentUnits` classifies first and folds second, and the result
 * travels on the row. `filterUnits` is then a membership test in any locale.
 */
export function classifyUnit(row: {
  unit_type: string;
  lagoon_access: string | null;
}): UnitCategory[] {
  const out: UnitCategory[] = [];
  if (/villa/i.test(row.unit_type)) out.push("villas");
  if (/town|terrace/i.test(row.unit_type)) out.push("townhouses");
  // "Walking · 2 min" is proximity, not access — it does not count.
  if (row.lagoon_access != null && !/walking/i.test(row.lagoon_access))
    out.push("lagoon");
  return out;
}

export function filterUnits(
  units: DevelopmentUnit[],
  filter: UnitFilter,
): DevelopmentUnit[] {
  if (filter === "all") return units;
  return units.filter((u) => u.categories.includes(filter));
}

export function countUnitsByFilter(
  units: DevelopmentUnit[],
): Record<UnitFilter, number> {
  return {
    all: filterUnits(units, "all").length,
    villas: filterUnits(units, "villas").length,
    townhouses: filterUnits(units, "townhouses").length,
    lagoon: filterUnits(units, "lagoon").length,
  };
}

/** Build the public URL for a development. */
export function developmentUrl(row: { slug: string }): string {
  return `/developments/${row.slug}`;
}
