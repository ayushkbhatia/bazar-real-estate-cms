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
};

/** Group units by lagoon-access category — used by the filter chips on
 *  the detail page (All / Villas / Townhouses / Lagoon access). */
export type UnitFilter = "all" | "villas" | "townhouses" | "lagoon";

export function filterUnits(
  units: DevelopmentUnit[],
  filter: UnitFilter,
): DevelopmentUnit[] {
  switch (filter) {
    case "villas":
      return units.filter((u) => /villa/i.test(u.unit_type));
    case "townhouses":
      return units.filter((u) => /town|terrace/i.test(u.unit_type));
    case "lagoon":
      return units.filter(
        (u) => u.lagoon_access != null && !/walking/i.test(u.lagoon_access),
      );
    case "all":
    default:
      return units;
  }
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
