import { afterEach, describe, expect, it } from "vitest";
import { decodePrefs, encodePrefs } from "./cookie";
import {
  areaUnitLabel,
  convertArea,
  formatArea,
  formatAreaRange,
  formatAreaValue,
  formatPrice,
  formatPricePerArea,
  toFt2,
} from "./formatters";
import { parseEcbDaily, staticFxRates } from "./fx-source";
import {
  AED_PER_USD,
  USD_PER_AED,
  convertFromAed,
  getRate,
  resetLiveRates,
  setLiveRates,
} from "./rates";
import { DEFAULT_PREFERENCES, isAreaUnit, isCurrency } from "./types";

afterEach(() => resetLiveRates());

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

  it("USD is the exact peg, not a rounded approximation", () => {
    expect(AED_PER_USD).toBe(3.6725);
    expect(getRate("USD")).toBe(1 / 3.6725);
    // 3.6725 AED buys exactly one dollar.
    expect(convertFromAed(3.6725, "USD")).toBeCloseTo(1, 12);
  });

  it("EUR is below USD (the euro is worth more than the dollar)", () => {
    const usd = convertFromAed(1_000_000, "USD");
    const eur = convertFromAed(1_000_000, "EUR");
    expect(eur).toBeLessThan(usd);
    expect(eur).toBeGreaterThan(usd * 0.7);
  });

  it("live rates override the static EUR fallback", () => {
    const before = getRate("EUR");
    setLiveRates({ EUR: 0.2361 });
    expect(getRate("EUR")).toBe(0.2361);
    resetLiveRates();
    expect(getRate("EUR")).toBe(before);
  });

  it("a live USD quote can never displace the peg", () => {
    setLiveRates({ USD: 0.5 });
    expect(getRate("USD")).toBe(USD_PER_AED);
  });

  it("malformed live values are ignored rather than stored", () => {
    setLiveRates({ EUR: Number.NaN });
    expect(Number.isFinite(getRate("EUR"))).toBe(true);
    setLiveRates({ EUR: -1 });
    expect(getRate("EUR")).toBeGreaterThan(0);
  });

  it("handles non-finite gracefully", () => {
    expect(convertFromAed(NaN, "USD")).toBe(0);
    expect(convertFromAed(Infinity, "USD")).toBe(0);
  });
});

describe("preferences/fx-source", () => {
  const ECB_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope>
  <Cube>
    <Cube time='2026-08-07'>
      <Cube currency='USD' rate='1.1535'/>
      <Cube currency='JPY' rate='182.64'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

  it("derives EUR/AED from the peg and the ECB's EUR/USD", () => {
    const fx = parseEcbDaily(ECB_SAMPLE);
    expect(fx).not.toBeNull();
    expect(fx!.source).toBe("ecb");
    expect(fx!.as_of).toBe("2026-08-07");
    expect(fx!.rates.USD).toBe(USD_PER_AED);
    // 1 AED = (1/3.6725) USD = 0.27229 USD; ÷ 1.1535 USD/EUR = 0.23606 EUR
    expect(fx!.rates.EUR).toBeCloseTo(0.23606, 5);
    expect(fx!.rates.AED).toBe(1);
  });

  it("rejects a feed with no USD line", () => {
    expect(parseEcbDaily("<Cube time='2026-08-07'></Cube>")).toBeNull();
  });

  it("rejects an implausible rate rather than shipping it", () => {
    expect(
      parseEcbDaily(
        `<Cube time='2026-08-07'><Cube currency='USD' rate='11535'/></Cube>`,
      ),
    ).toBeNull();
  });

  it("rejects a feed with no date", () => {
    expect(
      parseEcbDaily(`<Cube><Cube currency='USD' rate='1.1535'/></Cube>`),
    ).toBeNull();
  });

  it("the static fallback is well-formed and flagged as degraded", () => {
    const fx = staticFxRates();
    expect(fx.source).toBe("static");
    expect(fx.rates.USD).toBe(USD_PER_AED);
    expect(fx.rates.EUR).toBeGreaterThan(0);
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

  it("formatArea handles nullish input", () => {
    expect(formatArea(null)).toBe("—");
    expect(formatArea(undefined, "m2")).toBe("—");
  });

  it("areaUnitLabel returns the glyph for each unit", () => {
    expect(areaUnitLabel("ft2")).toBe("ft²");
    expect(areaUnitLabel("m2")).toBe("m²");
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
    expect(formatAreaRange(1240, 1480, "ft2")).toBe("1,240 – 1,480 ft²");
    expect(formatAreaRange(1240, 1240, "ft2")).toBe("1,240 ft²");
    expect(formatAreaRange(1240, null, "ft2")).toBe("1,240 ft²");
    expect(formatAreaRange(null, null, "ft2")).toBeNull();
    expect(formatAreaRange(1076.39, null, "m2")).toBe("100 m²");
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
