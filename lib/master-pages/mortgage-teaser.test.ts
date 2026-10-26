import { describe, expect, it } from "vitest";
import {
  MORTGAGE_TEASER_DEFAULTS,
  mortgageTeaserControls,
} from "./mortgage-teaser";

describe("mortgageTeaserControls", () => {
  it("is the shipped band when nothing is set", () => {
    expect(mortgageTeaserControls({})).toEqual(MORTGAGE_TEASER_DEFAULTS);
  });

  it("reads typed numbers, commas and percent signs included", () => {
    const c = mortgageTeaserControls({
      price_default: "3,000,000",
      price_min: "1,000,000",
      price_max: "15,000,000",
      rate_default: "3.99%",
    });
    expect(c.price).toEqual({ value: 3_000_000, min: 1_000_000, max: 15_000_000, step: 50_000 });
    expect(c.rate.value).toBe(3.99);
  });

  it("pulls a starting value into its range", () => {
    expect(mortgageTeaserControls({ term_default: "40" }).term.value).toBe(30);
  });

  it("falls back to the whole shipped slider for a range that cannot work", () => {
    expect(mortgageTeaserControls({ down_min: "90", down_max: "10" }).down).toEqual(
      MORTGAGE_TEASER_DEFAULTS.down,
    );
    expect(mortgageTeaserControls({ rate_step: "0" }).rate).toEqual(
      MORTGAGE_TEASER_DEFAULTS.rate,
    );
    expect(mortgageTeaserControls({ down_max: "150" }).down).toEqual(
      MORTGAGE_TEASER_DEFAULTS.down,
    );
  });

  it("ignores text that is not a number", () => {
    expect(mortgageTeaserControls({ price_default: "lots" }).price.value).toBe(2_500_000);
  });
});
