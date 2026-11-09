import { describe, it, expect } from "vitest";
import {
  parseFilters,
  countActiveFilters,
  describeFilters,
} from "./property";
import type { LifestyleTag } from "@/lib/lifestyle-tags";

describe("parseFilters", () => {
  it("returns an all-null state for an empty record", () => {
    const f = parseFilters({});
    expect(f).toEqual({
      q: null,
      beds: [],
      baths: [],
      type: null,
      segment: null,
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
      lifestyle: [],
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
      beds: [3],
      baths: [2],
      type: "apartment",
      segment: null,
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
      lifestyle: [],
      verified: null,
      advisor: null,
      sort: null,
      page: null,
    });
  });

  it("keeps known lifestyle tags, in vocabulary order, deduplicated", () => {
    expect(
      parseFilters({ lifestyle: "gated, waterfront,bogus,gated" }).lifestyle,
    ).toEqual(["waterfront", "gated"]);
    expect(parseFilters({ lifestyle: ["luxury", 7] }).lifestyle).toEqual([
      "luxury",
    ]);
    expect(parseFilters({ lifestyle: "" }).lifestyle).toEqual([]);
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
    expect(parseFilters({ beds: "999" }).beds).toEqual([5]);
    expect(parseFilters({ baths: "-3" }).baths).toEqual([]);
  });

  it("ignores non-numeric noise on numeric fields", () => {
    expect(parseFilters({ beds: "nope" }).beds).toEqual([]);
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
  beds: [] as number[],
  baths: [] as number[],
  type: null,
  segment: null,
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
  lifestyle: [] as LifestyleTag[],
  verified: null,
  advisor: null,
  sort: null,
  page: null,
} as const;

describe("bedroom and bathroom sets", () => {
  it("parses a comma list, sorted and de-duplicated", () => {
    expect(parseFilters({ beds: "2,1,2" }).beds).toEqual([1, 2]);
    expect(parseFilters({ baths: ["3", "1"] }).baths).toEqual([1, 3]);
  });

  it("keeps a lone count — the hero search and old links — as a set of one", () => {
    expect(parseFilters({ beds: "2" }).beds).toEqual([2]);
    expect(parseFilters({ beds: 0 }).beds).toEqual([0]);
  });

  it("folds anything at or over the cap into the cap, and drops junk", () => {
    expect(parseFilters({ beds: "7,5,x,-1" }).beds).toEqual([5]);
    expect(parseFilters({ baths: "9" }).baths).toEqual([4]);
    expect(parseFilters({ beds: "" }).beds).toEqual([]);
  });

  it("summarises every ticked count, the cap with a plus", () => {
    expect(describeFilters({ ...EMPTY, beds: [0, 2, 5] })).toBe(
      "Studio, 2 beds, 5+ beds",
    );
    expect(describeFilters({ ...EMPTY, baths: [1, 4] })).toBe(
      "1 bath, 4+ baths",
    );
  });
});

describe("countActiveFilters", () => {
  it("counts only non-null fields", () => {
    expect(
      countActiveFilters({
        ...EMPTY,
        beds: [3],
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
        beds: [3],
        type: "apartment",
        price_min: 2_000_000,
        price_max: 5_000_000,
        area: "saadiyat-island",
      },
      "Saadiyat Island",
    );
    expect(text).toContain("3 beds");
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
