import { describe, expect, it } from "vitest";
import { chosenLocale, decodePrefs, encodePrefs } from "./cookie";
import {
  areaUnitLabel,
  convertArea,
  formatArea,
  formatAreaRange,
  formatAreaValue,
  formatMoneyValue,
  formatPrice,
  formatPricePerArea,
  inputToPriceParam,
  priceParamToInput,
  toAed,
  toFt2,
} from "./formatters";
import { formatPriceAED } from "@/lib/queries/property-utils";
import { AED_PER_USD, convertFromAed, getRate } from "./rates";
import {
  CURRENCIES,
  DEFAULT_PREFERENCES,
  isAreaUnit,
  isCurrency,
} from "./types";

describe("preferences/types", () => {
  it("type guards accept valid values", () => {
    expect(isCurrency("AED")).toBe(true);
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("GBP")).toBe(false);
    // EUR was offered briefly and removed — see ADR-0006. An old cookie
    // carrying it must decode to the AED default, not resurrect the option.
    expect(isCurrency("EUR")).toBe(false);
    expect(CURRENCIES).toEqual(["AED", "USD"]);
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
    expect(decodePrefs("a=m2")).toEqual({
      currency: "AED",
      area_unit: "m2",
      locale: "en",
    });
  });

  it("a stale EUR cookie decodes to the AED default", () => {
    expect(decodePrefs("c=EUR&a=m2")).toEqual({
      currency: "AED",
      area_unit: "m2",
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

  it("carries a chosen locale alongside the other two", () => {
    // The proxy reads `l` on every request to decide whether an unprefixed URL
    // belongs in /ar. It has to survive a currency change written by the
    // popover, which re-encodes the whole cookie from a decode.
    const encoded = encodePrefs({
      currency: "USD",
      area_unit: "ft2",
      locale: "ar",
    });
    expect(encoded).toBe("c=USD&l=ar");
    expect(decodePrefs(encoded).locale).toBe("ar");
  });
});

/**
 * `chosenLocale` answers a narrower question than `decodePrefs`: not "what
 * locale applies" but "did the visitor say". The proxy needs the distinction —
 * silence means leave today's behaviour alone, and English means *pinned*,
 * which is the only way out of a sticky Arabic session.
 */
describe("preferences/chosenLocale", () => {
  it("is null when the visitor has never chosen", () => {
    expect(chosenLocale(null)).toBeNull();
    expect(chosenLocale("")).toBeNull();
    // A cookie that only carries currency is silence about language.
    expect(chosenLocale("c=USD&a=m2")).toBeNull();
  });

  it("reads a choice out of a full cookie", () => {
    expect(chosenLocale("c=USD&a=m2&l=ar")).toBe("ar");
    expect(chosenLocale("l=ar")).toBe("ar");
  });

  it("ignores a locale we do not serve", () => {
    // A stale value from a pulled experiment must not redirect anyone into a
    // 404. `en` is not in the cookie by design — it encodes as absence.
    expect(chosenLocale("l=fr")).toBeNull();
    expect(chosenLocale("l=")).toBeNull();
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

  it("USD is the exact peg, not a rounded approximation", () => {
    expect(AED_PER_USD).toBe(3.6725);
    expect(getRate("USD")).toBe(1 / 3.6725);
    // 3.6725 AED buys exactly one dollar.
    expect(convertFromAed(3.6725, "USD")).toBeCloseTo(1, 12);
  });

  it("handles non-finite gracefully", () => {
    expect(convertFromAed(NaN, "USD")).toBe(0);
    expect(convertFromAed(Infinity, "USD")).toBe(0);
  });
});

describe("preferences/formatters", () => {
  it("formatPrice renders AED and USD with compact M/K", () => {
    expect(formatPrice(4_200_000, { currency: "AED" })).toBe("AED 4.2M");
    expect(formatPrice(750_000, { currency: "AED" })).toBe("AED 750K");
    expect(formatPrice(500, { currency: "AED" })).toBe("AED 500");
    // USD keeps two decimals: a dollar is worth 3.6725 dirhams, so one
    // decimal there would be 3.7× coarser than the AED figure beside it.
    expect(formatPrice(4_200_000, { currency: "USD" })).toMatch(
      /^\$ \d+\.\d{2}M$/,
    );
  });

  /**
   * `formatPriceAED` still serves the surfaces with no visitor to ask — admin
   * tables, OG images, `generateMetadata`, email. If the two formatters drift,
   * the same listing starts quoting two prices depending on which one rendered
   * it, which is exactly the bug this equivalence was introduced to kill.
   */
  it("formatPrice in AED is byte-identical to the legacy formatPriceAED", () => {
    for (const n of [
      0, 1, 500, 999, 1_000, 1_001, 999_999, 1_000_000, 1_000_001, 4_200_000,
      7_940_000, 12_500_000, 50_000_000,
    ]) {
      expect(formatPrice(n, { currency: "AED" })).toBe(formatPriceAED(n));
    }
  });

  it("formatPrice handles nullish input", () => {
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
  });

  it("formatMoneyValue keeps every digit", () => {
    expect(formatMoneyValue(1_050_000, { currency: "AED" })).toBe(
      "AED 1,050,000",
    );
    expect(formatMoneyValue(1_050_000, { currency: "USD" })).toBe("$ 285,909");
    expect(formatMoneyValue(null)).toBe("—");
    expect(formatMoneyValue(undefined)).toBe("—");
  });

  it("formatArea converts ft² to m² when requested", () => {
    expect(formatArea(1000, { area_unit: "ft2" })).toBe("1,000 ft²");
    expect(formatArea(1000, { area_unit: "m2" })).toMatch(/^9[2-3] m²$/); // 1000 ft² ≈ 92.9 m²
  });

  it("formatArea handles nullish input", () => {
    expect(formatArea(null)).toBe("—");
    expect(formatArea(undefined, { area_unit: "m2" })).toBe("—");
  });

  it("areaUnitLabel returns the glyph for each unit", () => {
    expect(areaUnitLabel({ area_unit: "ft2" })).toBe("ft²");
    expect(areaUnitLabel({ area_unit: "m2" })).toBe("m²");
    expect(areaUnitLabel()).toBe("ft²");
  });

  it("formatAreaValue omits the unit so markup can render it separately", () => {
    expect(formatAreaValue(1000, "ft2")).toBe("1,000");
    expect(formatAreaValue(1000, "m2")).toBe("93");
    expect(formatAreaValue(null, "m2")).toBe("—");
  });

  it("convertArea and toFt2 round-trip", () => {
    const m2 = convertArea(2325, "m2");
    expect(m2).toBeCloseTo(216, 0);
    expect(toFt2(m2, "m2")).toBeCloseTo(2325, 6);
    // ft² is the storage unit, so both are identity there.
    expect(convertArea(2325, "ft2")).toBe(2325);
    expect(toFt2(2325, "ft2")).toBe(2325);
  });

  it("formatAreaRange collapses, converts, and drops empties", () => {
    expect(formatAreaRange(1240, 1480, { area_unit: "ft2" })).toBe(
      "1,240 – 1,480 ft²",
    );
    expect(formatAreaRange(1240, 1240, { area_unit: "ft2" })).toBe("1,240 ft²");
    expect(formatAreaRange(1240, null, { area_unit: "ft2" })).toBe("1,240 ft²");
    expect(formatAreaRange(null, null, { area_unit: "ft2" })).toBeNull();
    expect(formatAreaRange(1076.39, null, { area_unit: "m2" })).toBe("100 m²");
  });

  it("formatPricePerArea reflects both currency and unit", () => {
    const aedPerFt2 = 2000;
    const aedFt2 = formatPricePerArea(aedPerFt2, {
      currency: "AED",
      area_unit: "ft2",
    });
    expect(aedFt2).toMatch(/^AED [\d,]+\/ft²$/);

    const aedM2 = formatPricePerArea(aedPerFt2, {
      currency: "AED",
      area_unit: "m2",
    });
    expect(aedM2).toMatch(/^AED [\d,]+\/m²$/);
    // m² value should be ~10.76× larger
    const ft2Num = parseInt(aedFt2.replace(/[^\d]/g, ""), 10);
    const m2Num = parseInt(aedM2.replace(/[^\d]/g, ""), 10);
    expect(m2Num).toBeGreaterThan(ft2Num * 9);
    expect(m2Num).toBeLessThan(ft2Num * 11);
  });

  it("toAed inverts convertFromAed", () => {
    expect(toAed(1, "USD")).toBeCloseTo(3.6725, 12);
    expect(toAed(1_000_000, "AED")).toBe(1_000_000);
    expect(toAed(convertFromAed(4_200_000, "USD"), "USD")).toBeCloseTo(
      4_200_000,
      6,
    );
    expect(toAed(NaN, "USD")).toBe(0);
  });
});

/**
 * The URL stays AED whatever the visitor is typing, so a shared search link
 * means the same thing to both parties. These converters are the only place
 * the two units meet.
 */
describe("preferences/price param boundary", () => {
  it("converts an AED param into the visitor's currency and back", () => {
    expect(priceParamToInput("1836250", "USD")).toBe("500000");
    expect(inputToPriceParam("500000", "USD")).toBe("1836250");
    // AED is the storage currency, so both are identity there.
    expect(priceParamToInput("1836250", "AED")).toBe("1836250");
    expect(inputToPriceParam("1836250", "AED")).toBe("1836250");
  });

  it("what a USD visitor types is what the box reads back", () => {
    // The visitor's own round-trip — typed USD → AED in the URL → USD in the
    // box — is exact, because the AED figure lands within 0.5 of the true
    // product and 0.5/3.6725 = 0.136 < 0.5 coming back.
    for (let usd = 1; usd <= 200_000; usd += 7) {
      const asParam = inputToPriceParam(String(usd), "USD");
      expect(priceParamToInput(asParam, "USD")).toBe(String(usd));
    }
  });

  it("the reverse trip is lossy, which is why untouched params must pass through", () => {
    // AED → USD → AED is NOT recoverable: the dollar step compresses the range
    // and the dirham digits are gone. Drift is small (≤ 2 AED) but real, so a
    // caller must only push a price param through the converters when the
    // visitor actually edited that box. Pinned so nobody "simplifies"
    // filter-bar into rewriting every param on every commit.
    expect(inputToPriceParam(priceParamToInput("1", "USD"), "USD")).toBe("0");
    let maxDrift = 0;
    for (let aed = 1; aed <= 2_000_000; aed += 11) {
      const back = Number(
        inputToPriceParam(priceParamToInput(String(aed), "USD"), "USD"),
      );
      maxDrift = Math.max(maxDrift, Math.abs(back - aed));
    }
    expect(maxDrift).toBeLessThanOrEqual(2);
  });

  it("empty and non-numeric input yields an empty param", () => {
    expect(priceParamToInput("", "USD")).toBe("");
    expect(inputToPriceParam("", "USD")).toBe("");
    expect(inputToPriceParam("abc", "USD")).toBe("");
  });
});
