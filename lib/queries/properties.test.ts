import { describe, it, expect } from "vitest";
import {
  formatPriceAED,
  propertyUrl,
  extractReferenceFromSlug,
} from "./properties";

describe("formatPriceAED", () => {
  it("formats millions with one decimal", () => {
    expect(formatPriceAED(4_200_000)).toBe("AED 4.2M");
    expect(formatPriceAED(12_500_000)).toBe("AED 12.5M");
    expect(formatPriceAED(1_000_000)).toBe("AED 1.0M");
  });

  it("formats thousands with no decimals", () => {
    expect(formatPriceAED(160_000)).toBe("AED 160K");
    expect(formatPriceAED(1_500)).toBe("AED 2K");
  });

  it("falls back to locale-string for sub-thousand", () => {
    expect(formatPriceAED(750)).toBe("AED 750");
    expect(formatPriceAED(0)).toBe("AED 0");
  });
});

describe("propertyUrl", () => {
  it("joins slug with lowercase reference", () => {
    expect(
      propertyUrl({
        slug: "mamsha-3-bed-beachfront-apartment",
        reference: "BAZ-AD-04891",
      }),
    ).toBe("/p/mamsha-3-bed-beachfront-apartment-baz-ad-04891");
  });

  it("does not mutate already-lowercase references", () => {
    expect(
      propertyUrl({ slug: "nudra-villa", reference: "baz-ad-04864" }),
    ).toBe("/p/nudra-villa-baz-ad-04864");
  });
});

describe("extractReferenceFromSlug", () => {
  it("extracts a trailing BAZ-XX-NNNN reference", () => {
    expect(
      extractReferenceFromSlug("mamsha-3-bed-beachfront-apartment-baz-ad-04891"),
    ).toBe("BAZ-AD-04891");
    expect(extractReferenceFromSlug("nudra-villa-baz-ad-04864")).toBe(
      "BAZ-AD-04864",
    );
  });

  it("normalises mixed-case input", () => {
    expect(extractReferenceFromSlug("mixed-Baz-AD-12345")).toBe(
      "BAZ-AD-12345",
    );
  });

  it("supports varying sub-prefixes (single-emirate codes)", () => {
    expect(extractReferenceFromSlug("foo-baz-dxb-77777")).toBe(
      "BAZ-DXB-77777",
    );
  });

  it("returns null when no reference is present", () => {
    expect(extractReferenceFromSlug("just-a-slug")).toBeNull();
    expect(extractReferenceFromSlug("")).toBeNull();
    expect(extractReferenceFromSlug("baz-ad")).toBeNull();
    expect(extractReferenceFromSlug("baz-ad-")).toBeNull();
  });

  it("only matches the trailing pattern", () => {
    expect(
      extractReferenceFromSlug("baz-ad-04891-then-some-other-stuff"),
    ).toBeNull();
  });

  it("round-trips through propertyUrl", () => {
    const ref = "BAZ-AD-04891";
    const slug = "mamsha-3-bed-beachfront-apartment";
    const url = propertyUrl({ slug, reference: ref });
    const path = url.replace(/^\/p\//, "");
    expect(extractReferenceFromSlug(path)).toBe(ref);
  });
});
