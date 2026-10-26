import { describe, expect, it } from "vitest";
import { cardFactProps, listingFacts, typeRules } from "./type-rules";

const row = (
  type: string,
  extra: Partial<Parameters<typeof listingFacts>[0]> = {},
) => ({
  type,
  beds: 0,
  baths: 0,
  built_up_ft2: null,
  plot_ft2: 7575,
  ...extra,
});

describe("typeRules", () => {
  it("measures land by its plot alone", () => {
    expect(typeRules("land")).toMatchObject({
      builtUp: "none",
      plot: "required",
      rooms: false,
      plotInKeyFacts: true,
    });
  });

  it("keeps the old behaviour for a type not in the table", () => {
    expect(typeRules("apartment")).toMatchObject({
      rooms: true,
      plotInKeyFacts: false,
    });
    expect(typeRules(null).rooms).toBe(true);
  });
});

describe("listingFacts", () => {
  it("gives land no rooms and its plot as the area", () => {
    expect(listingFacts(row("land"))).toEqual({
      beds: null,
      baths: null,
      areaFt2: 7575,
      areaKind: "plot",
    });
  });

  it("ignores a built-up figure stored on land", () => {
    expect(
      listingFacts(row("land", { built_up_ft2: 47612, plot_ft2: 40000 }))
        .areaFt2,
    ).toBe(40000);
  });

  it("leaves an apartment as it was", () => {
    expect(
      listingFacts(row("apartment", { beds: 2, baths: 3, built_up_ft2: 1400 })),
    ).toEqual({
      beds: 2,
      baths: 3,
      areaFt2: 1400,
      areaKind: "built_up",
    });
  });
});

describe("cardFactProps", () => {
  it("still reads 0 for a missing built-up area, as cards always have", () => {
    expect(cardFactProps(row("villa", { beds: 4, baths: 5 })).area).toBe(0);
  });

  it("leaves the chip out for land with no plot", () => {
    expect(cardFactProps(row("land", { plot_ft2: null })).area).toBeNull();
  });
});
