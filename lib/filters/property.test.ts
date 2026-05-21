import { describe, it, expect } from "vitest";
import {
  parseFilters,
  countActiveFilters,
  describeFilters,
} from "./property";

describe("parseFilters", () => {
  it("returns an all-null state for an empty record", () => {
    const f = parseFilters({});
    expect(f).toEqual({
      q: null,
      beds: null,
      baths: null,
      type: null,
      price_min: null,
      price_max: null,
      area: null,
    });
  });

  it("parses common URL string values", () => {
    const f = parseFilters({
      q: "Saadiyat sea view",
      beds: "3",
      baths: "2",
      type: "apartment",
      price_min: "1000000",
      price_max: "5000000",
      area: "saadiyat-island",
    });
    expect(f).toEqual({
      q: "Saadiyat sea view",
      beds: 3,
      baths: 2,
      type: "apartment",
      price_min: 1_000_000,
      price_max: 5_000_000,
      area: "saadiyat-island",
    });
  });

  it("trims and caps the search query", () => {
    expect(parseFilters({ q: "   hello  " }).q).toBe("hello");
    const long = "x".repeat(500);
    const result = parseFilters({ q: long });
    expect(result.q?.length).toBe(200);
  });

  it("treats whitespace-only q as null", () => {
    expect(parseFilters({ q: "   " }).q).toBeNull();
    expect(parseFilters({ q: "" }).q).toBeNull();
  });

  it("rejects an unknown type and falls back to null", () => {
    expect(parseFilters({ type: "spaceship" }).type).toBeNull();
  });

  it("clamps beds/baths into a sane range", () => {
    expect(parseFilters({ beds: "999" }).beds).toBe(50);
    expect(parseFilters({ baths: "-3" }).baths).toBeNull();
  });

  it("ignores non-numeric noise on numeric fields", () => {
    expect(parseFilters({ beds: "nope" }).beds).toBeNull();
    expect(parseFilters({ price_min: "abc" }).price_min).toBeNull();
  });

  it("trims whitespace on area", () => {
    expect(parseFilters({ area: "  yas-island  " }).area).toBe("yas-island");
    expect(parseFilters({ area: "   " }).area).toBeNull();
  });
});

describe("countActiveFilters", () => {
  it("counts only non-null fields", () => {
    expect(
      countActiveFilters({
        q: null,
        beds: 3,
        baths: null,
        type: "apartment",
        price_min: null,
        price_max: 5_000_000,
        area: "saadiyat-island",
      }),
    ).toBe(4);
  });

  it("returns 0 for the empty state", () => {
    expect(
      countActiveFilters({
        q: null,
        beds: null,
        baths: null,
        type: null,
        price_min: null,
        price_max: null,
        area: null,
      }),
    ).toBe(0);
  });

  it("counts q as a filter when set", () => {
    expect(
      countActiveFilters({
        q: "saadiyat",
        beds: null,
        baths: null,
        type: null,
        price_min: null,
        price_max: null,
        area: null,
      }),
    ).toBe(1);
  });
});

describe("describeFilters", () => {
  it("renders a single-line summary", () => {
    const text = describeFilters(
      {
        q: null,
        beds: 3,
        baths: null,
        type: "apartment",
        price_min: 2_000_000,
        price_max: 5_000_000,
        area: "saadiyat-island",
      },
      "Saadiyat Island",
    );
    expect(text).toContain("3+ beds");
    expect(text).toContain("Apartments");
    expect(text).toContain("in Saadiyat Island");
    expect(text).toContain("AED 2.0M–5.0M");
  });

  it("returns an empty string when no filters are active", () => {
    expect(
      describeFilters({
        q: null,
        beds: null,
        baths: null,
        type: null,
        price_min: null,
        price_max: null,
        area: null,
      }),
    ).toBe("");
  });

  it("quotes the search term when present", () => {
    expect(
      describeFilters({
        q: "sea view",
        beds: null,
        baths: null,
        type: null,
        price_min: null,
        price_max: null,
        area: null,
      }),
    ).toBe('"sea view"');
  });
});
