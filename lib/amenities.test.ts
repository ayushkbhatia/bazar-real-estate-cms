import { describe, it, expect } from "vitest";
import {
  addCustomAmenity,
  amenityLabel,
  groupAmenities,
  normaliseAmenityList,
  orderAmenities,
  splitAmenities,
  toOptions,
  MAX_AMENITIES,
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

describe("duplicate labels in the taxonomy", () => {
  // Live taxonomy has three of these ("playground"/"playgroundd",
  // "marina"/"marinaa", "picnic_areas"/"picnic_areass") — distinct codes,
  // identical labels. We store labels, so each one used to occupy two slots
  // of the cap for one visible tick.
  const DUPES: AmenityTaxonomyEntry[] = [
    ...TAXONOMY,
    { code: "pooll", label: "Pool", category: "outdoor", icon: null, sort_order: 50, active: true },
  ];

  it("collapses to one option per label", () => {
    expect(toOptions(DUPES).map((o) => o.code)).toEqual(["pool", "spa", "gym"]);
  });

  it("does not store the same amenity twice", () => {
    expect(orderAmenities(["Pool"], toOptions(DUPES))).toEqual(["Pool"]);
  });

  it("stays single even if the caller hands it unfiltered options", () => {
    const raw = DUPES.map((t) => ({
      code: t.code,
      label: t.label,
      category: t.category,
    }));
    expect(orderAmenities(["Pool", "Gym"], raw)).toEqual(["Pool", "Gym"]);
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

  it("prints a custom amenity verbatim and sorts it after the taxonomy", () => {
    // The whole contract the public page relies on: a value an agent typed
    // renders as itself and can't blank out.
    expect(orderAmenities(["Rooftop cinema", "Pool"], OPTIONS)).toEqual([
      "Pool",
      "Rooftop cinema",
    ]);
    expect(amenityLabel("Rooftop cinema", OPTIONS)).toBe("Rooftop cinema");
  });
});

describe("normaliseAmenityList", () => {
  it("trims, collapses inner whitespace, and drops blanks", () => {
    expect(normaliseAmenityList([" Pool ", "Rooftop   cinema", "", "  "])).toEqual([
      "Pool",
      "Rooftop cinema",
    ]);
  });

  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(normaliseAmenityList(["Pool", "pool ", "POOL"])).toEqual(["Pool"]);
  });

  it("leaves an over-long entry intact for the schema to reject", () => {
    const long = "x".repeat(80);
    expect(normaliseAmenityList([long])).toEqual([long]);
  });
});

describe("addCustomAmenity", () => {
  it("appends a genuinely new value after the taxonomy ones", () => {
    const result = addCustomAmenity(["Gym", "Pool"], "  Rooftop   cinema ", OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toEqual(["Pool", "Gym", "Rooftop cinema"]);
    expect(result.matched).toBeNull();
  });

  it("selects the taxonomy card when the typed value already exists", () => {
    // Typing "gym" must not store a second spelling of Gym.
    const result = addCustomAmenity(["Pool"], "gym", OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toEqual(["Pool", "Gym"]);
    expect(result.matched?.code).toBe("gym");
  });

  it("resolves a taxonomy code as well as a label", () => {
    const result = addCustomAmenity([], "spa", OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toEqual(["Spa"]);
    expect(result.matched?.code).toBe("spa");
  });

  it("rejects a case-insensitive duplicate of a custom value already stored", () => {
    const result = addCustomAmenity(["Rooftop cinema"], "rooftop cinema", OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("duplicate");
  });

  it("rejects a duplicate of a taxonomy value already selected", () => {
    const result = addCustomAmenity(["Pool"], "POOL", OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("duplicate");
  });

  it("rejects blank input", () => {
    const result = addCustomAmenity(["Pool"], "   ", OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("empty");
  });

  it("rejects a value longer than the schema allows", () => {
    const result = addCustomAmenity([], "x".repeat(51), OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too_long");
  });

  it("rejects once the listing is at the cap", () => {
    const full = Array.from({ length: MAX_AMENITIES }, (_, i) => `Custom ${i}`);
    const result = addCustomAmenity(full, "One more", OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("limit");
  });
});
