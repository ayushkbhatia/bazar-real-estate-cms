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
      form: null,
      price_min: null,
      price_max: null,
      area: null,
      ft2_min: null,
      ft2_max: null,
      year_min: null,
      year_max: null,
      tenure: null,
      furnishing: null,
      amenities: [],
      verified: null,
      advisor: null,
      sort: null,
      page: null,
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
      form: null,
      price_min: 1_000_000,
      price_max: 5_000_000,
      area: "saadiyat-island",
      ft2_min: null,
      ft2_max: null,
      year_min: null,
      year_max: null,
      tenure: null,
      furnishing: null,
      amenities: [],
      verified: null,
      advisor: null,
      sort: null,
      page: null,
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

  // `form` is the completion axis — off-plan / ready (new) / resale (0110).
  // /buy/ready and /buy/resale narrow it from the route; this is the facet on
  // /buy/search, which is the surface where the buy umbrella spans all three.
  it("parses every completion form, including off_plan", () => {
    expect(parseFilters({ form: "off_plan" }).form).toBe("off_plan");
    expect(parseFilters({ form: "ready_new" }).form).toBe("ready_new");
    expect(parseFilters({ form: "resale" }).form).toBe("resale");
  });

  it("rejects an unknown form and falls back to null", () => {
    expect(parseFilters({ form: "handover_soon" }).form).toBeNull();
    expect(parseFilters({ form: "" }).form).toBeNull();
    expect(parseFilters({ form: 3 }).form).toBeNull();
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

// Sprint 4b: extended filter shape — every test object spreads EMPTY so we
// only have to set the fields a given case cares about.
const EMPTY = {
  q: null,
  beds: null,
  baths: null,
  type: null,
  form: null,
  price_min: null,
  price_max: null,
  area: null,
  ft2_min: null,
  ft2_max: null,
  year_min: null,
  year_max: null,
  tenure: null,
  furnishing: null,
  amenities: [] as string[],
  verified: null,
  advisor: null,
  sort: null,
  page: null,
} as const;

describe("countActiveFilters", () => {
  it("counts only non-null fields", () => {
    expect(
      countActiveFilters({
        ...EMPTY,
        beds: 3,
        type: "apartment",
        price_max: 5_000_000,
        area: "saadiyat-island",
      }),
    ).toBe(4);
  });

  it("returns 0 for the empty state", () => {
    expect(countActiveFilters({ ...EMPTY })).toBe(0);
  });

  it("counts q as a filter when set", () => {
    expect(countActiveFilters({ ...EMPTY, q: "saadiyat" })).toBe(1);
  });
});

describe("describeFilters", () => {
  it("renders a single-line summary", () => {
    const text = describeFilters(
      {
        ...EMPTY,
        beds: 3,
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

  it("names the completion form so the result count says what it counted", () => {
    expect(describeFilters({ ...EMPTY, form: "off_plan" })).toBe("Off-plan");
    expect(describeFilters({ ...EMPTY, form: "ready_new" })).toBe("Ready (new)");
  });

  it("returns an empty string when no filters are active", () => {
    expect(describeFilters({ ...EMPTY })).toBe("");
  });

  it("quotes the search term when present", () => {
    expect(describeFilters({ ...EMPTY, q: "sea view" })).toBe('"sea view"');
  });
});
