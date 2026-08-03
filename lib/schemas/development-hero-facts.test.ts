import { describe, expect, it } from "vitest";
import {
  developmentHeroFactsPartialSchema,
  developmentEditSchema,
  developmentHeroFactsSchema,
  evaluateDevelopmentHeroFacts,
  parseHeroFactNumber,
} from "./development";

const COMPLETE = {
  starting_price: 6_200_000,
  bedrooms_text: "1–4 bed",
  total_units: 312,
  handover_date: "2027-12-31",
};

describe("developmentHeroFactsSchema", () => {
  it("accepts a complete set", () => {
    expect(developmentHeroFactsSchema.parse(COMPLETE)).toEqual(COMPLETE);
  });

  it.each([
    ["starting_price", null],
    ["bedrooms_text", null],
    ["total_units", null],
    ["handover_date", null],
  ])("rejects a missing %s", (field, value) => {
    const result = developmentHeroFactsSchema.safeParse({
      ...COMPLETE,
      [field]: value,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank or whitespace-only bedrooms string", () => {
    expect(
      developmentHeroFactsSchema.safeParse({ ...COMPLETE, bedrooms_text: "" })
        .success,
    ).toBe(false);
    expect(
      developmentHeroFactsSchema.safeParse({
        ...COMPLETE,
        bedrooms_text: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects zero or negative numbers", () => {
    // A project starting at AED 0 or with 0 units is a data-entry slip, not a
    // real project — and the hero would render it as though it were real.
    for (const patch of [
      { starting_price: 0 },
      { starting_price: -1 },
      { total_units: 0 },
    ]) {
      expect(
        developmentHeroFactsSchema.safeParse({ ...COMPLETE, ...patch }).success,
      ).toBe(false);
    }
  });

  it("rejects a fractional unit count", () => {
    expect(
      developmentHeroFactsSchema.safeParse({ ...COMPLETE, total_units: 12.5 })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed handover date", () => {
    for (const bad of ["2027", "Q4 2027", "31-12-2027", ""]) {
      expect(
        developmentHeroFactsSchema.safeParse({
          ...COMPLETE,
          handover_date: bad,
        }).success,
      ).toBe(false);
    }
  });

  it("trims the bedrooms string", () => {
    const parsed = developmentHeroFactsSchema.parse({
      ...COMPLETE,
      bedrooms_text: "  studio–3 bed  ",
    });
    expect(parsed.bedrooms_text).toBe("studio–3 bed");
  });
});

describe("evaluateDevelopmentHeroFacts", () => {
  it("passes a complete row with no blockers", () => {
    const gate = evaluateDevelopmentHeroFacts(COMPLETE);
    expect(gate.ok).toBe(true);
    expect(gate.blockers).toEqual([]);
    expect(gate.checks.every((c) => c.passed)).toBe(true);
  });

  it("names every missing field, not just the first", () => {
    const gate = evaluateDevelopmentHeroFacts({
      starting_price: null,
      bedrooms_text: null,
      total_units: null,
      handover_date: null,
    });
    expect(gate.ok).toBe(false);
    expect(gate.blockers).toHaveLength(4);
  });

  it("reports one blocker per missing field", () => {
    const gate = evaluateDevelopmentHeroFacts({
      ...COMPLETE,
      total_units: null,
    });
    expect(gate.ok).toBe(false);
    expect(gate.blockers).toEqual(["Total units is missing"]);
  });

  it("always returns four checks, for the UI to render", () => {
    expect(evaluateDevelopmentHeroFacts(COMPLETE).checks).toHaveLength(4);
    expect(
      evaluateDevelopmentHeroFacts({
        starting_price: null,
        bedrooms_text: null,
        total_units: null,
        handover_date: null,
      }).checks,
    ).toHaveLength(4);
  });

  it("treats zero as missing, matching the schema", () => {
    // The gate and the schema must agree, or a row could save through one path
    // and be rejected by the other.
    expect(
      evaluateDevelopmentHeroFacts({ ...COMPLETE, starting_price: 0 }).ok,
    ).toBe(false);
    expect(
      evaluateDevelopmentHeroFacts({ ...COMPLETE, total_units: 0 }).ok,
    ).toBe(false);
  });
});

describe("developmentHeroFactsPartialSchema", () => {
  it("accepts an entirely empty draft", () => {
    // Saving progress on a half-filled project must work; the publish gate is
    // what stops it going live.
    const result = developmentHeroFactsPartialSchema.safeParse({
      starting_price: null,
      bedrooms_text: null,
      total_units: null,
      handover_date: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a partially filled draft", () => {
    const result = developmentHeroFactsPartialSchema.safeParse({
      ...COMPLETE,
      total_units: null,
      handover_date: null,
    });
    expect(result.success).toBe(true);
  });

  it("still rejects a bad value that was actually supplied", () => {
    // Leniency is about absence, not about accepting nonsense.
    for (const patch of [
      { starting_price: -5 },
      { total_units: 2.5 },
      { handover_date: "Q4 2027" },
      { bedrooms_text: "x".repeat(41) },
    ]) {
      expect(
        developmentHeroFactsPartialSchema.safeParse({ ...COMPLETE, ...patch })
          .success,
        JSON.stringify(patch),
      ).toBe(false);
    }
  });
});

describe("parseHeroFactNumber", () => {
  it("returns null for blank, so it reads as 'not filled in yet'", () => {
    expect(parseHeroFactNumber("")).toBeNull();
    expect(parseHeroFactNumber("   ")).toBeNull();
  });

  it("strips thousands separators — the brochure-paste case", () => {
    expect(parseHeroFactNumber("6,200,000")).toBe(6_200_000);
    expect(parseHeroFactNumber("AED 6,200,000")).toBe(6_200_000);
    expect(parseHeroFactNumber("aed 312")).toBe(312);
    expect(parseHeroFactNumber(" 6 200 000 ")).toBe(6_200_000);
  });

  it("parses ordinary numbers", () => {
    expect(parseHeroFactNumber("6200000")).toBe(6_200_000);
    expect(parseHeroFactNumber("312")).toBe(312);
    expect(parseHeroFactNumber("6200000.50")).toBe(6_200_000.5);
    expect(parseHeroFactNumber("0312")).toBe(312);
  });

  it("returns NaN for input that is present but unreadable", () => {
    // Distinct from null on purpose: the caller shows "enter a number" rather
    // than "required", which would be wrong — they did enter something.
    // Note "6,,2" is deliberately absent: separators are stripped before the
    // check, so it reads as 62. Odd input, defensible result.
    for (const bad of ["6.2M", "abc", "1e9", "--5", "AED", "6-2"]) {
      expect(Number.isNaN(parseHeroFactNumber(bad)), bad).toBe(true);
    }
  });

  it("does not silently accept Infinity", () => {
    expect(Number.isNaN(parseHeroFactNumber("Infinity"))).toBe(true);
  });
});

describe("zero agrees across all three definitions", () => {
  // Regression: developmentEditSchema used .min(0) while the hero schemas used
  // .positive() and the gate used > 0. A row saved with 0 was then reported as
  // "missing" by the gate AND rejected by the card — which resubmits all four
  // fields together, so one stored 0 blocked editing every other field.
  it("rejects zero in the record-editor schema too", () => {
    const base = {
      name: "Test Project",
      slug: "test-project",
      status: "pre_launch" as const,
      developer_id: "00000000-0000-0000-0000-000000000000",
    };
    expect(
      developmentEditSchema.safeParse({ ...base, total_units: 0 }).success,
    ).toBe(false);
    expect(
      developmentEditSchema.safeParse({ ...base, starting_price: 0 }).success,
    ).toBe(false);
  });

  it("still allows null in the record-editor schema", () => {
    const base = {
      name: "Test Project",
      slug: "test-project",
      status: "pre_launch" as const,
      developer_id: "00000000-0000-0000-0000-000000000000",
      total_units: null,
      starting_price: null,
    };
    expect(developmentEditSchema.safeParse(base).success).toBe(true);
  });

  it("treats zero as missing in the gate, matching the schemas", () => {
    expect(
      evaluateDevelopmentHeroFacts({ ...COMPLETE, total_units: 0 }).blockers,
    ).toEqual(["Total units is missing"]);
    expect(
      evaluateDevelopmentHeroFacts({ ...COMPLETE, starting_price: 0 }).blockers,
    ).toEqual(["Starting price is missing"]);
  });
});
