import { describe, expect, it } from "vitest";
import {
  MORTGAGE_CALCULATOR_DEFAULTS as D,
  mortgageCalculatorControls,
  mortgageOpening,
} from "./mortgage-calculator-controls";

const settings = { priceAed: 2_500_000, downPaymentPct: 0.2, ratePct: 4.25, termYears: 25, annualIncomeAed: 600_000 };

describe("mortgage calculator controls", () => {
  it("ships the page's old behaviour when every box is blank", () => {
    const c = mortgageCalculatorControls({});
    expect(c).toEqual(D);
    expect(mortgageOpening({}, settings, c)).toEqual(settings);
  });

  it("reads typed ranges, percentages as fractions, and the term list longest first", () => {
    const c = mortgageCalculatorControls({
      price_min: "1,000,000",
      price_slider_max: "20,000,000",
      price_max: "60000000",
      price_step: "100,000",
      down_min: "20%",
      down_max: "70",
      down_step: "5",
      rate_max: "12",
      term_options: "10, 30, 20, 30",
      type_default: "variable",
      status_default: "uae_national",
      gauge_comfort: "30",
    });
    expect(c.price).toEqual({ min: 1_000_000, sliderMax: 20_000_000, max: 60_000_000, step: 100_000 });
    expect(c.down).toEqual({ min: 0.2, max: 0.7, step: 0.05 });
    expect(c.rate.max).toBe(12);
    expect(c.termOptions).toEqual([30, 20, 10]);
    expect(c.type).toBe("variable");
    expect(c.status).toBe("uae_national");
    expect(c.gaugeComfort).toBe(0.3);
  });

  it("drops a range that cannot work, whole, and junk choices", () => {
    const c = mortgageCalculatorControls({
      price_min: "9,000,000",
      price_slider_max: "5,000,000",
      down_min: "80",
      down_max: "20",
      term_options: "forever",
      type_default: "balloon",
      gauge_comfort: "0",
    });
    expect(c.price).toEqual(D.price);
    expect(c.down).toEqual(D.down);
    expect(c.termOptions).toEqual(D.termOptions);
    expect(c.type).toBe(D.type);
    expect(c.gaugeComfort).toBe(D.gaugeComfort);
  });

  it("never lets the slider stop past the highest typable price", () => {
    expect(mortgageCalculatorControls({ price_max: "8,000,000" }).price.sliderMax).toBe(8_000_000);
  });

  it("opens on the editor's starting values, inside the ranges and on a listed term", () => {
    const c = mortgageCalculatorControls({ term_options: "20, 15" });
    const o = mortgageOpening(
      { price_default: "90,000,000", down_default: "30", rate_default: "5.1", term_default: "25", income_default: "480,000" },
      settings,
      c,
    );
    expect(o).toEqual({ priceAed: 50_000_000, downPaymentPct: 0.3, ratePct: 5.1, termYears: 20, annualIncomeAed: 480_000 });
    // Settings' 25 years isn't offered: the nearest option is.
    expect(mortgageOpening({}, settings, c).termYears).toBe(20);
  });
});
