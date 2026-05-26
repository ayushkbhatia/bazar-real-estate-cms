import { describe, expect, it } from "vitest";
import { decodePrefs, encodePrefs } from "./cookie";
import { formatArea, formatPrice, formatPricePerArea } from "./formatters";
import { convertFromAed, getRate } from "./rates";
import { DEFAULT_PREFERENCES, isAreaUnit, isCurrency } from "./types";

describe("preferences/types", () => {
  it("type guards accept valid values", () => {
    expect(isCurrency("AED")).toBe(true);
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("EUR")).toBe(true);
    expect(isCurrency("GBP")).toBe(false);
    expect(isCurrency(null)).toBe(false);
    expect(isAreaUnit("ft2")).toBe(true);
    expect(isAreaUnit("m2")).toBe(true);
    expect(isAreaUnit("yd2")).toBe(false);
  });
});

describe("preferences/cookie", () => {
  it("default preferences encode to an empty string (compact)", () => {
    expect(encodePrefs(DEFAULT_PREFERENCES)).toBe("");
  });

  it("non-default values round-trip", () => {
    const encoded = encodePrefs({
      currency: "USD",
      area_unit: "m2",
      locale: "en",
    });
    expect(encoded).toBe("c=USD&a=m2");
    expect(decodePrefs(encoded)).toEqual({
      currency: "USD",
      area_unit: "m2",
      locale: "en",
    });
  });

  it("partial values fall back to defaults", () => {
    expect(decodePrefs("c=EUR")).toEqual({
      currency: "EUR",
      area_unit: "ft2",
      locale: "en",
    });
  });

  it("invalid values are dropped", () => {
    expect(decodePrefs("c=GBP&a=yd2")).toEqual(DEFAULT_PREFERENCES);
  });

  it("null / undefined / empty returns defaults", () => {
    expect(decodePrefs(null)).toEqual(DEFAULT_PREFERENCES);
    expect(decodePrefs(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(decodePrefs("")).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("preferences/rates", () => {
  it("AED-to-AED is 1:1", () => {
    expect(getRate("AED")).toBe(1);
    expect(convertFromAed(1_000_000, "AED")).toBe(1_000_000);
  });

  it("USD conversion is finite and positive", () => {
    const usd = convertFromAed(1_000_000, "USD");
    expect(usd).toBeGreaterThan(0);
    expect(usd).toBeLessThan(1_000_000);
    expect(Number.isFinite(usd)).toBe(true);
  });

  it("EUR is roughly USD * 0.92", () => {
    const usd = convertFromAed(1_000_000, "USD");
    const eur = convertFromAed(1_000_000, "EUR");
    expect(eur).toBeLessThan(usd);
    expect(eur).toBeGreaterThan(usd * 0.85);
  });

  it("handles non-finite gracefully", () => {
    expect(convertFromAed(NaN, "USD")).toBe(0);
    expect(convertFromAed(Infinity, "USD")).toBe(0);
  });
});

describe("preferences/formatters", () => {
  it("formatPrice renders AED, USD, EUR with compact M/K", () => {
    expect(formatPrice(4_200_000, { currency: "AED" })).toBe("AED 4.20M");
    expect(formatPrice(750_000, { currency: "AED" })).toBe("AED 750K");
    expect(formatPrice(500, { currency: "AED" })).toBe("AED 500");
    expect(formatPrice(4_200_000, { currency: "USD" })).toMatch(/^\$ \d+\.\d{2}M$/);
    expect(formatPrice(4_200_000, { currency: "EUR" })).toMatch(/^€ \d+\.\d{2}M$/);
  });

  it("formatPrice handles nullish input", () => {
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
  });

  it("formatArea converts ft² to m² when requested", () => {
    expect(formatArea(1000, "ft2")).toBe("1,000 ft²");
    expect(formatArea(1000, "m2")).toMatch(/^9[2-3] m²$/); // 1000 ft² ≈ 92.9 m²
  });

  it("formatPricePerArea reflects both currency and unit", () => {
    const aedPerFt2 = 2000;
    const aedFt2 = formatPricePerArea(aedPerFt2, {
      currency: "AED",
      area_unit: "ft2",
      locale: "en",
    });
    expect(aedFt2).toMatch(/^AED [\d,]+\/ft²$/);

    const aedM2 = formatPricePerArea(aedPerFt2, {
      currency: "AED",
      area_unit: "m2",
      locale: "en",
    });
    expect(aedM2).toMatch(/^AED [\d,]+\/m²$/);
    // m² value should be ~10.76× larger
    const ft2Num = parseInt(aedFt2.replace(/[^\d]/g, ""), 10);
    const m2Num = parseInt(aedM2.replace(/[^\d]/g, ""), 10);
    expect(m2Num).toBeGreaterThan(ft2Num * 9);
    expect(m2Num).toBeLessThan(ft2Num * 11);
  });
});
