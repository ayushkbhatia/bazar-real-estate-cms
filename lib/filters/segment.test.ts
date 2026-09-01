import { describe, expect, it } from "vitest";
import {
  FILTER_PARAM_KEYS,
} from "./property-keys";
import {
  countActiveFilters,
  describeFilters,
  filterParsers,
  parseFilters,
  type PropertyFilters,
} from "./property";
import { PROPERTY_SEGMENTS } from "@/lib/schemas/property";

/**
 * The residential / commercial axis.
 *
 * `mode` is the transaction — for sale, to let, off-plan. `segment` is what
 * kind of building it is. They used to be the same enum, which is why the
 * search surfaces offered "Commercial" as a fourth alternative to Buy and
 * Rent: a commercial unit had to record one of the two facts and drop the
 * other. Migration 0121 split them; this covers the querystring half.
 */

const EMPTY = parseFilters({});

describe("the segment filter", () => {
  it("reads both values off the querystring", () => {
    for (const segment of PROPERTY_SEGMENTS) {
      expect(parseFilters({ segment }).segment).toBe(segment);
    }
  });

  it("ignores a value that is not a segment", () => {
    // Including `mode` values, which is the plausible mistake: a hand-written
    // `?segment=buy` is someone confusing the two axes, and the honest answer
    // is "no segment filter", not an empty result set.
    for (const bad of ["buy", "rent", "off_plan", "", "RESIDENTIAL", "1"]) {
      expect(parseFilters({ segment: bad }).segment).toBeNull();
    }
  });

  it("defaults to neither, which means both", () => {
    // The catalogue is almost entirely residential. Defaulting the filter to
    // residential would hide the commercial stock from every visitor who never
    // touched the control — on a site where nobody would think to look.
    expect(EMPTY.segment).toBeNull();
  });

  it("counts as a narrowing filter", () => {
    // It drives the empty-state copy: filtered to Commercial with nothing to
    // show has to read "try widening", not "nothing here".
    expect(countActiveFilters({ ...EMPTY, segment: "commercial" })).toBe(1);
    expect(countActiveFilters(EMPTY)).toBe(0);
  });

  it("names itself in the filter summary", () => {
    expect(describeFilters({ ...EMPTY, segment: "commercial" })).toBe(
      "Commercial",
    );
    expect(describeFilters({ ...EMPTY, segment: "residential" })).toBe(
      "Residential",
    );
  });

  it("sits alongside the other filters rather than replacing them", () => {
    const f: PropertyFilters = {
      ...EMPTY,
      segment: "commercial",
      beds: 2,
      type: "apartment",
    };
    expect(describeFilters(f)).toBe("2+ beds · Apartments · Commercial");
  });

  it("composes with the completion form rather than replacing it", () => {
    // The two strips above the results are different axes: what kind of
    // building, and how a sale is coming to market. "Commercial resale" is a
    // real thing to look for, and both halves have to survive together.
    const f = parseFilters({ segment: "commercial", form: "resale" });
    expect(f.segment).toBe("commercial");
    expect(f.form).toBe("resale");
    expect(countActiveFilters(f)).toBe(2);
    expect(describeFilters(f)).toBe("Commercial · Resale");
  });

  it("is a key the proxy recognises as a search", () => {
    // `FILTER_PARAM_KEYS` is hand-maintained so the middleware bundle does not
    // pull in nuqs; a key missing from it means `/buy?segment=commercial`
    // silently lands on the marketing page instead of the results.
    expect(FILTER_PARAM_KEYS).toContain("segment");
    expect(Object.keys(filterParsers)).toContain("segment");
  });
});
