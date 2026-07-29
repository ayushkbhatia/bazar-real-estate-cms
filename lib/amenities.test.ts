import { describe, it, expect } from "vitest";
import {
  amenityLabel,
  groupAmenities,
  orderAmenities,
  splitAmenities,
  toOptions,
} from "./amenities";
import type { AmenityTaxonomyEntry } from "./schemas/amenity-taxonomy";

const TAXONOMY: AmenityTaxonomyEntry[] = [
  { code: "pool", label: "Pool", category: "outdoor", icon: null, sort_order: 10, active: true },
  { code: "gym", label: "Gym", category: "wellness", icon: null, sort_order: 30, active: true },
  { code: "spa", label: "Spa", category: "wellness", icon: null, sort_order: 20, active: true },
  { code: "old", label: "Retired", category: "indoor", icon: null, sort_order: 40, active: false },
];

const OPTIONS = toOptions(TAXONOMY);

describe("toOptions", () => {
  it("drops inactive entries and sorts by the taxonomy's own order", () => {
    expect(OPTIONS.map((o) => o.code)).toEqual(["pool", "spa", "gym"]);
  });

  it("falls back to the shipped defaults when given nothing", () => {
    expect(toOptions().length).toBeGreaterThan(0);
  });
});

describe("groupAmenities", () => {
  it("groups by category and hides empty groups", () => {
    const groups = groupAmenities(OPTIONS);
    expect(groups.map((g) => g.category)).toEqual(["outdoor", "wellness"]);
    expect(groups[1].items.map((i) => i.code)).toEqual(["spa", "gym"]);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });
});

describe("splitAmenities", () => {
  it("separates taxonomy values from legacy free text", () => {
    const { known, unknown } = splitAmenities(
      ["Pool", "Private garden", "Gym"],
      OPTIONS,
    );
    expect(known).toEqual(["Pool", "Gym"]);
    // Kept, not dropped — 84 mentions in the live catalogue are values like
    // this, and deleting them silently on save would be data loss.
    expect(unknown).toEqual(["Private garden"]);
  });

  it("matches case-insensitively and accepts codes", () => {
    const { known, unknown } = splitAmenities(["pool", "  GYM  "], OPTIONS);
    expect(known).toEqual(["Pool", "Gym"]);
    expect(unknown).toEqual([]);
  });

  it("de-duplicates and ignores blanks", () => {
    const { known, unknown } = splitAmenities(
      ["Pool", "pool", "", "   ", "Terrace", "Terrace"],
      OPTIONS,
    );
    expect(known).toEqual(["Pool"]);
    expect(unknown).toEqual(["Terrace"]);
  });

  it("treats a deactivated amenity as legacy rather than silently keeping it", () => {
    const { known, unknown } = splitAmenities(["Retired"], OPTIONS);
    expect(known).toEqual([]);
    expect(unknown).toEqual(["Retired"]);
  });
});

describe("orderAmenities", () => {
  it("stores in taxonomy order, not click order", () => {
    // Clicked gym → pool → spa; stored pool → spa → gym, so record diffs and
    // audit history stay readable.
    expect(orderAmenities(["Gym", "Pool", "Spa"], OPTIONS)).toEqual([
      "Pool",
      "Spa",
      "Gym",
    ]);
  });

  it("keeps legacy values at the end, in their original order", () => {
    expect(
      orderAmenities(["Tennis court", "Gym", "Private garden", "Pool"], OPTIONS),
    ).toEqual(["Pool", "Gym", "Tennis court", "Private garden"]);
  });

  it("is stable — re-ordering an ordered list changes nothing", () => {
    const once = orderAmenities(["Gym", "Pool", "Zebra"], OPTIONS);
    expect(orderAmenities(once, OPTIONS)).toEqual(once);
  });
});

describe("amenityLabel", () => {
  it("resolves codes and passes unknown values through untouched", () => {
    expect(amenityLabel("pool", OPTIONS)).toBe("Pool");
    expect(amenityLabel("Pool", OPTIONS)).toBe("Pool");
    // A listing showing "Private garden" keeps showing it, rather than
    // vanishing from the public page because it predates the taxonomy.
    expect(amenityLabel("Private garden", OPTIONS)).toBe("Private garden");
  });
});
