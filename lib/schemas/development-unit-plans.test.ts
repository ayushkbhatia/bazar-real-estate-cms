import { describe, it, expect } from "vitest";
import {
  MAX_PLANS_PER_TYPE,
  blankUnitType,
  deriveUnitTypeSeeds,
  seedUnitTypes,
  unitPlansSchema,
  unitTypeLabel,
} from "./development-unit-plans";

const labels = (text: string | null) =>
  deriveUnitTypeSeeds(text).map((t) => t.label);

describe("deriveUnitTypeSeeds", () => {
  it("reads the bedroom ranges the catalogue actually stores", () => {
    // Every one of these is a real `developments.bedrooms_text` value.
    expect(labels("1–3 bed")).toEqual(["1 Bedroom", "2 Bedroom", "3 Bedroom"]);
    expect(labels("1 - 3")).toEqual(["1 Bedroom", "2 Bedroom", "3 Bedroom"]);
    expect(labels("2–5 bed")).toEqual([
      "2 Bedroom",
      "3 Bedroom",
      "4 Bedroom",
      "5 Bedroom",
    ]);
    expect(labels("3 - 6")).toHaveLength(4);
  });

  it("adds a studio when the string mentions one", () => {
    expect(labels("Studios, 1 - 3")).toEqual([
      "Studio",
      "1 Bedroom",
      "2 Bedroom",
      "3 Bedroom",
    ]);
  });

  it("ignores digits that are part of a longer number", () => {
    // "1313" is a typo in the live data, not a 1- and 3-bedroom range. Reading
    // it as one is what a bare /[1-9]/ would do — the lookarounds are what
    // stop it, which is why widening the digit range was safe.
    expect(labels("1313")).toEqual(["1 Bedroom", "2 Bedroom", "3 Bedroom"]);
  });

  it("falls back to 1-3 when there is nothing to read", () => {
    expect(labels(null)).toEqual(["1 Bedroom", "2 Bedroom", "3 Bedroom"]);
    expect(labels("")).toEqual(["1 Bedroom", "2 Bedroom", "3 Bedroom"]);
  });

  it("reads a range past what the brief provisioned for", () => {
    // Used to stop at 7 and so read "1 - 9" as a lone 1-bed project.
    expect(deriveUnitTypeSeeds("1 - 9").map((t) => t.beds)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("labels a studio as a studio", () => {
    expect(unitTypeLabel(0)).toBe("Studio");
    expect(unitTypeLabel(2)).toBe("2 Bedroom");
  });
});

describe("seedUnitTypes", () => {
  it("gives every type two placeholder layouts and copy to replace", () => {
    const seeded = seedUnitTypes("Studios, 1 - 2");
    expect(seeded.map((t) => t.label)).toEqual([
      "Studio",
      "1 Bedroom",
      "2 Bedroom",
    ]);
    for (const type of seeded) {
      expect(type.plans).toHaveLength(2);
      expect(type.plans.map((p) => p.label)).toEqual(["Layout A", "Layout B"]);
      // No media picked — the card draws its placeholder art instead.
      expect(type.plans.every((p) => p.media_id === null)).toBe(true);
      expect(type.blurb).toMatch(/^Placeholder copy/);
    }
  });

  it("passes its own validation", () => {
    const result = unitPlansSchema.safeParse({
      unit_types: seedUnitTypes("1 - 4"),
    });
    expect(result.success).toBe(true);
  });
});

describe("unitPlansSchema", () => {
  it("rejects two unit types sharing a label", () => {
    const result = unitPlansSchema.safeParse({
      unit_types: [blankUnitType("2 Bedroom", 2), blankUnitType("2 bedroom", 2)],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(["unit_types", 1, "label"]);
    }
  });

  it("rejects a size range that runs backwards", () => {
    const type = blankUnitType("1 Bedroom", 1);
    const result = unitPlansSchema.safeParse({
      unit_types: [{ ...type, size_from_ft2: 1400, size_to_ft2: 900 }],
    });
    expect(result.success).toBe(false);
  });

  it("caps how many layouts one unit type can store", () => {
    const type = blankUnitType("1 Bedroom", 1);
    const result = unitPlansSchema.safeParse({
      unit_types: [
        {
          ...type,
          plans: Array.from({ length: MAX_PLANS_PER_TYPE + 1 }, (_, i) => ({
            ...type.plans[0]!,
            label: `Layout ${i}`,
          })),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("puts no ceiling on bedrooms or bathrooms", () => {
    // The editor that hit "Too big: expected number to be <=9" was entering a
    // real bathroom count, not a typo. Neither field is capped now.
    const type = blankUnitType("Penthouse", 12);
    const result = unitPlansSchema.safeParse({
      unit_types: [
        { ...type, plans: [{ ...type.plans[0]!, beds: 14, baths: 16 }] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("still rejects a count that would overflow the column", () => {
    const type = blankUnitType("1 Bedroom", 1);
    const result = unitPlansSchema.safeParse({
      unit_types: [
        { ...type, plans: [{ ...type.plans[0]!, baths: 99_999_999_999 }] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires a label on every unit type", () => {
    const result = unitPlansSchema.safeParse({
      unit_types: [blankUnitType("", 1)],
    });
    expect(result.success).toBe(false);
  });
});
