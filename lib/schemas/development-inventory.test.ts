import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_UNITS,
  UNIT_STATUSES,
  blankUnit,
  inventorySchema,
  unitRowSchema,
} from "./development-inventory";

const VALID = {
  id: null,
  unit_type: "Villa A",
  unit_type_ar: "فيلا أ",
  beds: 4,
  built_up_ft2: 3800,
  plot_ft2: 5200,
  lagoon_access: "Direct",
  lagoon_access_ar: "مباشر",
  orientation: "NW",
  orientation_ar: "شمال غربي",
  price_aed: 6_200_000,
  plot_number: "A-12",
  status: "available" as const,
  floor_plan_id: null,
};

describe("unitRowSchema", () => {
  it("accepts a full row", () => {
    expect(unitRowSchema.safeParse(VALID).success).toBe(true);
  });

  it("requires a unit type", () => {
    const r = unitRowSchema.safeParse({ ...VALID, unit_type: "  " });
    // Trimmed only on write, so a blank string is caught by min(1) via the
    // action's trim — an all-space value is what the message is for.
    expect(r.success).toBe(true);
    expect(unitRowSchema.safeParse({ ...VALID, unit_type: "" }).success).toBe(
      false,
    );
  });

  /**
   * The twins are `.nullable()` and deliberately **not** `.optional()`.
   *
   * `persist` in `_inventory-actions.ts` names every column and rewrites the
   * whole row on update, so a twin missing from the payload is a twin erased.
   * Required-with-null turns that into a parse error the editor sees, instead
   * of a success toast over deleted Arabic — the same choice unit types and the
   * megamenu make, and for the same reason.
   */
  it.each(["unit_type_ar", "lagoon_access_ar", "orientation_ar"] as const)(
    "rejects a payload that omits %s entirely",
    (key) => {
      const { [key]: _dropped, ...without } = VALID;
      expect(unitRowSchema.safeParse(without).success).toBe(false);
    },
  );

  it("accepts an explicit null twin", () => {
    expect(
      unitRowSchema.safeParse({ ...VALID, unit_type_ar: null }).success,
    ).toBe(true);
  });

  it("gives Arabic a longer cap than its English sibling", () => {
    // Arabic runs longer than the English it renders; a cap copied across
    // would truncate valid translations.
    expect(
      unitRowSchema.safeParse({ ...VALID, unit_type_ar: "ف".repeat(120) })
        .success,
    ).toBe(true);
    expect(
      unitRowSchema.safeParse({ ...VALID, unit_type_ar: "ف".repeat(121) })
        .success,
    ).toBe(false);
  });

  it("rejects a status outside the enum", () => {
    expect(
      unitRowSchema.safeParse({ ...VALID, status: "pending" }).success,
    ).toBe(false);
  });

  it("matches the database enum exactly", () => {
    // Reads the migration rather than db/types.ts, so a drifted generated file
    // cannot make this pass.
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/0009_offplan_concierge.sql"),
      "utf8",
    );
    const match = sql.match(
      /create type public\.development_unit_status as enum\s*\(([^)]+)\)/,
    );
    expect(match).not.toBeNull();
    const inDb = [...match![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect([...UNIT_STATUSES].sort()).toEqual(inDb.sort());
  });
});

describe("blankUnit", () => {
  it("parses, so a newly added row is never invalid on arrival", () => {
    const blank = blankUnit();
    expect(unitRowSchema.safeParse(blank).success).toBe(false); // no type yet
    expect(unitRowSchema.safeParse(blankUnit("Villa A")).success).toBe(true);
  });

  it("names every key the schema requires", () => {
    // Catches the omission class above at the source: a column added to the
    // schema but forgotten in the blank row would ship as a save-time error.
    const keys = Object.keys(blankUnit("x")).sort();
    const shape = Object.keys(unitRowSchema.shape).sort();
    expect(keys).toEqual(shape);
  });
});

describe("inventorySchema", () => {
  it("accepts an empty grid", () => {
    expect(inventorySchema.safeParse({ units: [] }).success).toBe(true);
  });

  it("caps the grid", () => {
    const rows = Array.from({ length: MAX_UNITS + 1 }, () => VALID);
    expect(inventorySchema.safeParse({ units: rows }).success).toBe(false);
  });
});
