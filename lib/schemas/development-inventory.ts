import { z } from "zod";
import { uuidLike } from "@/lib/uuid";

/**
 * Sales inventory — the individual units a project has left.
 *
 * Not to be confused with `development_unit_types`, which is the *catalogue*
 * ("3-bed villa, from 3,800 ft², from AED 6.2m") and lives in
 * `development-unit-plans.ts`. This is the stock list behind the "What's left"
 * table: one row per real plot, with its own price, its own plot number and its
 * own availability. A project has a handful of unit types and can have two
 * hundred units.
 *
 * The table has existed since migration 0009 and the public page has rendered
 * it since Sprint 5 — but nothing in `app/` has ever written to it. All eight
 * rows in production sit on one unpublished project and match
 * `supabase/seed-developments.sql`. Adding the Arabic twins in 0104 is what
 * surfaced that: there was nowhere to type the Arabic because there was nowhere
 * to type the English either.
 */

/**
 * Not a product ceiling so much as a payload one. The save rewrites every row
 * it is given, so the whole grid travels on each save; two hundred rows is
 * already a 40kB action call, and a project with more inventory than that wants
 * a CSV import rather than a hand-edited grid.
 */
export const MAX_UNITS = 200;

const INT4_MAX = 2_147_483_647;

/** Mirrors the `development_unit_status` enum from migration 0009. */
export const UNIT_STATUSES = ["available", "held", "reserved", "sold"] as const;
export type UnitStatusInput = (typeof UNIT_STATUSES)[number];

export const UNIT_STATUS_LABELS: Record<UnitStatusInput, string> = {
  available: "Available",
  held: "Held",
  reserved: "Reserved",
  sold: "Sold",
};

export const unitRowSchema = z.object({
  /** Null for a row added in the grid and not yet saved. */
  id: uuidLike().nullable(),
  unit_type: z.string().min(1, "Name the unit type").max(80),
  /* Arabic twins are required-with-null, not optional. `persist` names every
   * column and rewrites the whole row on update, so a twin missing from the
   * payload is a twin erased — the same shape as unit types and the megamenu,
   * and the reason those two use this form. An omission has to be a loud parse
   * error rather than a silent overwrite. Caps are 1.5x the English, which is
   * roughly what the same sentence costs in Arabic. */
  unit_type_ar: z.string().max(120).nullable(),
  beds: z.number().int().min(0).max(INT4_MAX).nullable(),
  built_up_ft2: z.number().int().min(0).max(1_000_000).nullable(),
  plot_ft2: z.number().int().min(0).max(1_000_000).nullable(),
  lagoon_access: z.string().max(80).nullable(),
  lagoon_access_ar: z.string().max(120).nullable(),
  orientation: z.string().max(40).nullable(),
  orientation_ar: z.string().max(60).nullable(),
  price_aed: z.number().min(0).max(9_999_999_999).nullable(),
  /* Free text on purpose. There is no unique index on it and inventing one
   * here would block a save on data that predates the editor. */
  plot_number: z.string().max(40).nullable(),
  status: z.enum(UNIT_STATUSES),
  /** Optional link to a layout in the catalogue, so the row can show a plan. */
  floor_plan_id: uuidLike().nullable(),
});

export type UnitRowInput = z.infer<typeof unitRowSchema>;

export const inventorySchema = z.object({
  units: z.array(unitRowSchema).max(MAX_UNITS),
});

export function blankUnit(unitType = ""): UnitRowInput {
  return {
    id: null,
    unit_type: unitType,
    unit_type_ar: null,
    beds: null,
    built_up_ft2: null,
    plot_ft2: null,
    lagoon_access: null,
    lagoon_access_ar: null,
    orientation: null,
    orientation_ar: null,
    price_aed: null,
    plot_number: null,
    status: "available",
    floor_plan_id: null,
  };
}
