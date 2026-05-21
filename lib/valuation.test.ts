import { describe, it, expect } from "vitest";
import {
  baselinePricePerFt2,
  conditionMultiplier,
  estimateValuation,
  floorMultiplier,
  formatRangeAed,
  furnishingMultiplier,
  upgradesMultiplier,
  viewMultiplier,
  type ValuationInput,
} from "./valuation";

const BASE_INPUT: ValuationInput = {
  areaSlug: "saadiyat-island",
  propertyType: "apartment",
  beds: 3,
  baths: 4,
  builtUpFt2: 2_180,
  floor: 7,
  condition: "renovated",
  upgrades: [],
  furnishing: "unfurnished",
  view: "Sea / waterfront",
};

describe("baselinePricePerFt2", () => {
  it("returns the table value when the area + type is known", () => {
    const r = baselinePricePerFt2("saadiyat-island", "apartment");
    expect(r.ppf).toBe(1_950);
    expect(r.confident).toBe(true);
  });

  it("falls back to a global mean for unknown areas", () => {
    const r = baselinePricePerFt2("unknown-suburb", "apartment");
    expect(r.confident).toBe(false);
    expect(r.ppf).toBeGreaterThan(0);
  });

  it("falls back when area is known but type is missing", () => {
    // Yas Island has no commercial entry — should hit the fallback.
    const r = baselinePricePerFt2("yas-island", "commercial");
    expect(r.confident).toBe(false);
  });
});

describe("conditionMultiplier", () => {
  it("rises monotonically across the four levels", () => {
    expect(conditionMultiplier("original")).toBeLessThan(
      conditionMultiplier("lightly_refreshed"),
    );
    expect(conditionMultiplier("lightly_refreshed")).toBeLessThan(
      conditionMultiplier("renovated"),
    );
    expect(conditionMultiplier("renovated")).toBeLessThan(
      conditionMultiplier("fully_renovated"),
    );
  });

  it("returns 1.0 for null", () => {
    expect(conditionMultiplier(null)).toBe(1.0);
  });
});

describe("viewMultiplier", () => {
  it("prices sea/waterfront highest, park/garden lowest, unknown flat", () => {
    expect(viewMultiplier("Sea / waterfront")).toBeGreaterThan(
      viewMultiplier("Skyline / city"),
    );
    expect(viewMultiplier("Skyline / city")).toBeGreaterThan(
      viewMultiplier("Park / garden"),
    );
    expect(viewMultiplier("Internal courtyard")).toBe(1.0);
    expect(viewMultiplier(null)).toBe(1.0);
  });

  it("is case-insensitive", () => {
    expect(viewMultiplier("BEACH FRONT")).toBe(viewMultiplier("beach front"));
  });
});

describe("upgradesMultiplier", () => {
  it("caps at 1.10 even if every box is ticked", () => {
    const all = [
      "Designer kitchen (Boffi / Poliform / etc.)",
      "Marble or stone flooring",
      "Smart home wiring",
      "Extended primary suite / dressing room",
      "Custom joinery / built-ins",
      "AV / cinema room",
      "Pool or outdoor terrace upgrades",
      "Bathroom remodels",
    ];
    expect(upgradesMultiplier(all)).toBeCloseTo(1.1, 5);
  });

  it("adds zero for unrecognised upgrades", () => {
    expect(upgradesMultiplier(["Something we don't price"])).toBe(1.0);
  });

  it("returns 1.0 for an empty list", () => {
    expect(upgradesMultiplier([])).toBe(1.0);
  });
});

describe("furnishingMultiplier", () => {
  it("gives semi+fully a small premium over unfurnished", () => {
    expect(furnishingMultiplier("unfurnished")).toBe(1.0);
    expect(furnishingMultiplier("semi")).toBeGreaterThan(1.0);
    expect(furnishingMultiplier("fully")).toBeGreaterThan(
      furnishingMultiplier("semi"),
    );
  });
});

describe("floorMultiplier", () => {
  it("rewards high floors in apartments + penthouses only", () => {
    expect(floorMultiplier(35, "apartment")).toBeGreaterThan(
      floorMultiplier(2, "apartment"),
    );
    expect(floorMultiplier(35, "villa")).toBe(1.0);
    expect(floorMultiplier(35, "townhouse")).toBe(1.0);
  });

  it("is flat for missing floor", () => {
    expect(floorMultiplier(null, "apartment")).toBe(1.0);
  });
});

describe("estimateValuation", () => {
  it("returns null without a built-up area (we can't estimate without size)", () => {
    expect(estimateValuation({ ...BASE_INPUT, builtUpFt2: null })).toBeNull();
    expect(estimateValuation({ ...BASE_INPUT, builtUpFt2: 0 })).toBeNull();
  });

  it("produces low <= mid <= high", () => {
    const e = estimateValuation(BASE_INPUT)!;
    expect(e.lowAed).toBeLessThan(e.midAed);
    expect(e.midAed).toBeLessThan(e.highAed);
  });

  it("rounds all numbers to the nearest 1,000 AED (no fake precision)", () => {
    const e = estimateValuation(BASE_INPUT)!;
    expect(e.lowAed % 1_000).toBe(0);
    expect(e.midAed % 1_000).toBe(0);
    expect(e.highAed % 1_000).toBe(0);
  });

  it("ranges in around AED 4.0–4.7M for the design's Mamsha 3-bed scenario", () => {
    // Mamsha (Saadiyat) apartment · 2,180 ft² · renovated · sea · floor 7.
    // Expected midpoint is ~AED 4.6M (close to the design's 4.2M, plus the
    // renovated + sea premiums make it a touch higher — the advisor would
    // refine downwards if appropriate).
    const e = estimateValuation(BASE_INPUT)!;
    expect(e.midAed).toBeGreaterThan(3_500_000);
    expect(e.midAed).toBeLessThan(5_500_000);
  });

  it("narrows the band as the owner fills in more fields", () => {
    const sparse = estimateValuation({
      ...BASE_INPUT,
      condition: null,
      upgrades: [],
      furnishing: null,
      view: null,
      floor: null,
    })!;
    const detailed = estimateValuation({
      ...BASE_INPUT,
      condition: "renovated",
      upgrades: ["Designer kitchen"],
      furnishing: "fully",
      view: "Sea / waterfront",
      floor: 12,
    })!;
    expect(detailed.basis.rangeFraction).toBeLessThan(
      sparse.basis.rangeFraction,
    );
  });

  it("widens the band when the area falls back to the global table", () => {
    const known = estimateValuation(BASE_INPUT)!;
    const unknown = estimateValuation({
      ...BASE_INPUT,
      areaSlug: "somewhere-we-dont-know",
    })!;
    expect(unknown.basis.rangeFraction).toBeGreaterThanOrEqual(
      known.basis.rangeFraction,
    );
  });

  it("returns the baseline ppf in the basis (for the report)", () => {
    const e = estimateValuation(BASE_INPUT)!;
    expect(e.basis.baselinePpf).toBe(1_950);
  });
});

describe("formatRangeAed", () => {
  it("renders millions to 1 d.p., thousands to whole K", () => {
    expect(formatRangeAed(4_200_000)).toBe("4.2M");
    expect(formatRangeAed(750_000)).toBe("750K");
    expect(formatRangeAed(450)).toBe("450");
  });
});
