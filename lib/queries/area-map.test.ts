import { describe, it, expect } from "vitest";
import {
  parseGeo,
  computeCentroid,
  areaTag,
  pickMedianPerFt2,
  dotMeta,
  shapeDot,
} from "./area-map";

describe("parseGeo", () => {
  it("reads a well-formed {lat,lng} blob", () => {
    expect(parseGeo({ lat: 24.5, lng: 54.4 })).toEqual({
      lat: 24.5,
      lng: 54.4,
    });
  });

  it("coerces numeric strings (jsonb round-trips)", () => {
    expect(parseGeo({ lat: "24.5", lng: "54.4" })).toEqual({
      lat: 24.5,
      lng: 54.4,
    });
  });

  it("rejects null, non-objects, and partial blobs", () => {
    expect(parseGeo(null)).toBeNull();
    expect(parseGeo(undefined)).toBeNull();
    expect(parseGeo("54.4,24.5")).toBeNull();
    expect(parseGeo({ lat: 24.5 })).toBeNull();
    expect(parseGeo({ lat: "abc", lng: 54.4 })).toBeNull();
  });
});

describe("computeCentroid", () => {
  it("averages the points", () => {
    expect(
      computeCentroid([
        { lng: 54.4, lat: 24.5 },
        { lng: 54.6, lat: 24.7 },
      ]),
    ).toEqual({ lng: 54.5, lat: 24.6 });
  });

  it("returns the single point unchanged", () => {
    expect(computeCentroid([{ lng: 54.4, lat: 24.5 }])).toEqual({
      lng: 54.4,
      lat: 24.5,
    });
  });

  it("returns null for an empty set", () => {
    expect(computeCentroid([])).toBeNull();
  });
});

describe("areaTag", () => {
  it("returns the curated tag for a known area", () => {
    expect(areaTag("al-reem-island")).toBe("Investor · high yield");
    expect(areaTag("saadiyat-island")).toBe("Cultural quarter · beachfront");
  });

  it("returns null for an unknown slug", () => {
    expect(areaTag("nowhere-island")).toBeNull();
  });
});

describe("pickMedianPerFt2", () => {
  it("prefers the apartment median", () => {
    expect(
      pickMedianPerFt2({
        median_apt_aed_per_ft2: 1480,
        median_villa_aed_per_ft2: 1820,
      }),
    ).toBe(1480);
  });

  it("falls back to villa median for villa-only clusters", () => {
    expect(
      pickMedianPerFt2({
        median_apt_aed_per_ft2: 0,
        median_villa_aed_per_ft2: 5200,
      }),
    ).toBe(5200);
  });

  it("returns null when both are zero / missing", () => {
    expect(
      pickMedianPerFt2({
        median_apt_aed_per_ft2: 0,
        median_villa_aed_per_ft2: 0,
      }),
    ).toBeNull();
    expect(pickMedianPerFt2({})).toBeNull();
  });
});

describe("dotMeta", () => {
  it("labels a studio when beds is 0", () => {
    expect(dotMeta(0, 640)).toBe("Studio · 640 ft²");
  });

  it("pluralises bed shorthand and formats the area", () => {
    expect(dotMeta(2, 1180)).toBe("2 bd · 1,180 ft²");
  });

  it("drops the size when it is missing or zero", () => {
    expect(dotMeta(3, null)).toBe("3 bd");
    expect(dotMeta(3, 0)).toBe("3 bd");
  });

  it("drops beds when null", () => {
    expect(dotMeta(null, 900)).toBe("900 ft²");
  });
});

describe("shapeDot", () => {
  const base = {
    slug: "mamsha-studio",
    reference: "BAZ-AD-04891",
    price_aed: 1_900_000,
    title: "Studio · Mamsha",
    beds: 0,
    built_up_ft2: 640,
  };

  // The dot carries raw numbers, never formatted strings — the popup is a
  // client component and formats in the visitor's currency and area unit.
  it("shapes a located property into a dot", () => {
    expect(shapeDot({ ...base, geo: { lat: 24.5, lng: 54.4 } })).toEqual({
      slug: "mamsha-studio",
      reference: "BAZ-AD-04891",
      lng: 54.4,
      lat: 24.5,
      priceAed: 1_900_000,
      title: "Studio · Mamsha",
      beds: 0,
      builtUpFt2: 640,
      metaText: null,
    });
  });

  it("returns null when the property has no geo", () => {
    expect(shapeDot({ ...base, geo: null })).toBeNull();
  });

  it("coerces a stringified price", () => {
    const dot = shapeDot({
      ...base,
      price_aed: "2500000",
      geo: { lat: 24.5, lng: 54.4 },
    });
    expect(dot?.priceAed).toBe(2_500_000);
  });

  it("uses 0 as the no-price sentinel, since MapLibre drops nulls", () => {
    const dot = shapeDot({
      ...base,
      price_aed: "not a number",
      geo: { lat: 24.5, lng: 54.4 },
    });
    expect(dot?.priceAed).toBe(0);
  });
});
