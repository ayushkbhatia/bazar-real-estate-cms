import { describe, expect, it } from "vitest";
import { arabicNumeral, numeralOverrides } from "./numerals";
import { mask } from "./mask";

/**
 * The magnitude words and month names that masking protects — and therefore
 * strands in English unless something puts them back in Arabic.
 *
 * Every case below is a real token from the article corpus, not an invented
 * one; the counts in `numerals.ts` come from the same sweep.
 */
describe("arabicNumeral", () => {
  it("translates the magnitude word and leaves the figure alone", () => {
    expect(arabicNumeral("AED 84.49 billion")).toBe("84.49 مليار درهم");
    expect(arabicNumeral("AED 4.2M")).toBe("4.2 مليون درهم");
    expect(arabicNumeral("80K")).toBe("80 ألف");
  });

  /**
   * The currency is Arabic and it TRAILS the figure — both from
   * `lib/preferences/unit-labels.ts`, so a translated sentence and the price
   * rendered beside it use the same word in the same order. This used to keep
   * "AED" Latin; the dictionary is what changed the answer.
   */
  it("writes the currency in Arabic, after the figure", () => {
    expect(arabicNumeral("AED 4.2M")).toBe("4.2 مليون درهم");
    expect(arabicNumeral("AED 4.2M")).not.toContain("AED");
  });

  it("is case-insensitive about the magnitude word", () => {
    // "AED 100 Billion" appears capitalised in a headline.
    expect(arabicNumeral("AED 100 Billion")).toBe("100 مليار درهم");
  });

  it("translates quarters, halves and month names", () => {
    expect(arabicNumeral("Q1 2026")).toBe("الربع الأول 2026");
    expect(arabicNumeral("H1 2026")).toBe("النصف الأول من 2026");
    expect(arabicNumeral("September 2026")).toBe("سبتمبر 2026");
  });

  /**
   * A money token with no magnitude word used to be left alone, because there
   * was no English WORD in it to strand. There is now: "AED" itself. Leaving
   * this branch out would have produced "1,927 AED" beside "4.2 مليون درهم" in
   * the same paragraph.
   */
  it("localises a bare currency figure too", () => {
    expect(arabicNumeral("AED 1,927")).toBe("1,927 درهم");
    expect(arabicNumeral("AED 30")).toBe("30 درهم");
  });

  it("leaves percentages, areas and regulators alone", () => {
    expect(arabicNumeral("12%")).toBeNull();
    expect(arabicNumeral("11,000 ft²")).toBeNull();
    // The client's own Arabic writes "خاضعة لإشراف ADREC وDLD", so these are
    // Latin on purpose and translating them would diverge from their copy.
    expect(arabicNumeral("ADREC")).toBeNull();
    expect(arabicNumeral("DLD")).toBeNull();
  });
});

describe("numeralOverrides", () => {
  it("keys the overrides by the index mask() assigned", () => {
    const text = "Sales reached AED 84.49 billion in H1 2026, up 12%.";
    const m = mask(text);
    const overrides = numeralOverrides(m);
    // The percentage carries no English word, so it is absent by design.
    expect(Object.values(overrides)).toEqual([
      "84.49 مليار درهم",
      "النصف الأول من 2026",
    ]);
  });

  it("returns nothing for text with no numeric tokens", () => {
    expect(numeralOverrides(mask("Talk to an advisor"))).toEqual({});
  });
});

/**
 * `H1 2026` was NOT masked until this landed, and the failure was loud rather
 * than subtle: the model read the bare "H1" as prose and translated it, leaving
 * the year behind, so the headline came back reading "…النصف الأول من 1 2026"
 * and the excerpt failed `numeral-drift` outright.
 */
describe("the half-year form the market reports are written around", () => {
  it("is masked as one token", () => {
    const { tokens, kinds } = mask("Sales surged in H1 2026");
    expect(tokens).toContain("H1 2026");
    expect(kinds[tokens.indexOf("H1 2026")]).toBe("date");
  });
});
