import { describe, it, expect } from "vitest";
import {
  rankProperties,
  scoreProperty,
  type ScorableProperty,
} from "./scoring";
import type { ConciergeBrief } from "./brief";

function makeProperty(over: Partial<ScorableProperty>): ScorableProperty {
  return {
    id: "p1",
    reference: "BAZ-AD-00001",
    title: "Sample villa",
    price_aed: 5_000_000,
    mode: "buy",
    type: "villa",
    beds: 4,
    baths: 4,
    built_up_ft2: 4_500,
    amenities: ["Private pool", "Beach access"],
    flags: { vacant_on_transfer: true },
    area_slug: "saadiyat-island",
    area_name: "Saadiyat Island",
    ...over,
  };
}

describe("scoreProperty", () => {
  it("returns 50 when the brief is empty (no factors)", () => {
    const p = makeProperty({});
    const result = scoreProperty(p, { chips: [] });
    expect(result.score).toBe(50);
    expect(result.factors).toHaveLength(0);
    expect(result.property_id).toBe("p1");
  });

  it("scores 100 when every brief constraint matches", () => {
    const brief: ConciergeBrief = {
      mode: "buy",
      area_slugs: ["saadiyat-island"],
      beds_min: 3,
      beds_max: 5,
      price_min: 1_000_000,
      price_max: 10_000_000,
      must_have_amenities: ["beach access"],
      flags: { vacant_on_transfer: true },
      chips: [],
    };
    const result = scoreProperty(makeProperty({}), brief);
    expect(result.score).toBe(100);
    expect(result.factors.every((f) => f.status === "match")).toBe(true);
  });

  it("scores partial when price is slightly over budget", () => {
    const brief: ConciergeBrief = {
      price_max: 4_000_000, // budget is 4M but property is 5M (25% over)
      chips: [],
    };
    const r = scoreProperty(makeProperty({}), brief);
    expect(r.factors[0].status).toBe("miss"); // 25% > 10%, miss
  });

  it("scores partial when price is within 10% of cap", () => {
    const brief: ConciergeBrief = { price_max: 4_700_000, chips: [] }; // 5M is 6.4% over
    const r = scoreProperty(makeProperty({}), brief);
    expect(r.factors[0].status).toBe("partial");
  });

  it("under-budget price scores partial (not miss)", () => {
    const brief: ConciergeBrief = { price_min: 6_000_000, chips: [] };
    const r = scoreProperty(makeProperty({}), brief);
    expect(r.factors[0].status).toBe("partial");
  });

  it("misses area when slug doesn't match", () => {
    const brief: ConciergeBrief = { area_slugs: ["yas-island"], chips: [] };
    const r = scoreProperty(makeProperty({}), brief);
    expect(r.factors[0].status).toBe("miss");
  });

  it("matches beds within range, partials when one off", () => {
    const brief: ConciergeBrief = {
      beds_min: 5,
      beds_max: 6,
      chips: [],
    };
    const r = scoreProperty(makeProperty({ beds: 4 }), brief); // 1 below min
    expect(r.factors[0].status).toBe("partial");

    const r2 = scoreProperty(makeProperty({ beds: 7 }), brief); // 1 above max
    expect(r2.factors[0].status).toBe("partial");

    const r3 = scoreProperty(makeProperty({ beds: 2 }), brief); // far off
    expect(r3.factors[0].status).toBe("miss");
  });

  it("scores amenities via fuzzy substring match", () => {
    const brief: ConciergeBrief = {
      must_have_amenities: ["pool"], // user typed "pool" — should match "Private pool"
      chips: [],
    };
    const r = scoreProperty(makeProperty({}), brief);
    const am = r.factors.find((f) => f.label.includes("amenities"));
    expect(am?.status).toBe("match");
  });

  it("partials amenities when only some match", () => {
    const brief: ConciergeBrief = {
      must_have_amenities: ["pool", "marina", "gym"],
      chips: [],
    };
    const r = scoreProperty(makeProperty({}), brief);
    // Property has "Private pool" (matches "pool") + "Beach access" (matches
    // neither marina nor gym). 1/3 → partial.
    const am = r.factors.find((f) => f.label.includes("amenities"));
    expect(am?.status).toBe("partial");
  });

  it("matches flag requests when all flags present", () => {
    const brief: ConciergeBrief = {
      flags: { vacant_on_transfer: true, mortgage_eligible: true },
      chips: [],
    };
    const r = scoreProperty(
      makeProperty({
        flags: { vacant_on_transfer: true, mortgage_eligible: true },
      }),
      brief,
    );
    const flagFactor = r.factors.find((f) => f.label.includes("flag"));
    expect(flagFactor?.status).toBe("match");
  });
});

describe("rankProperties", () => {
  it("sorts highest-score first; stable order for ties", () => {
    const brief: ConciergeBrief = {
      area_slugs: ["saadiyat-island"],
      chips: [],
    };
    const props = [
      makeProperty({ id: "miss", area_slug: "yas-island" }),
      makeProperty({ id: "match-a" }),
      makeProperty({ id: "match-b" }), // same score as match-a; should retain order
      makeProperty({ id: "miss2", area_slug: "al-raha" }),
    ];
    const ranked = rankProperties(props, brief);
    expect(ranked.map((r) => r.property_id)).toEqual([
      "match-a",
      "match-b",
      "miss",
      "miss2",
    ]);
  });

  it("handles an empty list", () => {
    expect(rankProperties([], { chips: [] })).toEqual([]);
  });
});
