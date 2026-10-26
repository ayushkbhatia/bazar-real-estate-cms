import { describe, expect, it } from "vitest";
import {
  fifthKeyFact,
  plotInSpecification,
  tenureInSpecification,
} from "./key-facts";

describe("fifthKeyFact", () => {
  it("shows the plot for a villa", () => {
    expect(fifthKeyFact({ type: "villa", plot_ft2: 7200 })).toEqual({
      kind: "plot",
      ft2: 7200,
    });
  });

  it("omits the tile for a villa with no plot size", () => {
    expect(fifthKeyFact({ type: "villa", plot_ft2: null })).toBeNull();
    expect(fifthKeyFact({ type: "villa", plot_ft2: 0 })).toBeNull();
  });

  it("shows the plot for a townhouse, and omits the tile without one", () => {
    expect(fifthKeyFact({ type: "townhouse", plot_ft2: 2400 })).toEqual({
      kind: "plot",
      ft2: 2400,
    });
    expect(fifthKeyFact({ type: "townhouse", plot_ft2: null })).toBeNull();
  });

  it("shows the plot for land and the commercial types that take one (Oct 2026)", () => {
    for (const type of ["land", "office", "retail", "building", "commercial_villa"]) {
      expect(fifthKeyFact({ type, plot_ft2: 3000 })).toEqual({ kind: "plot", ft2: 3000 });
      expect(fifthKeyFact({ type, plot_ft2: null })).toBeNull();
    }
  });

  it("keeps tenure for every other type, plot or not", () => {
    for (const type of ["apartment", "penthouse", "hotel_apartment"]) {
      expect(fifthKeyFact({ type, plot_ft2: 3000 })).toEqual({ kind: "tenure" });
      expect(fifthKeyFact({ type, plot_ft2: null })).toEqual({ kind: "tenure" });
    }
  });
});

describe("specification swap", () => {
  it("moves tenure into the table and plot out of it for a villa", () => {
    expect(tenureInSpecification("villa")).toBe(true);
    expect(plotInSpecification("villa")).toBe(false);
  });

  it("leaves the table as it was for other types", () => {
    expect(tenureInSpecification("apartment")).toBe(false);
    expect(plotInSpecification("penthouse")).toBe(true);
    expect(tenureInSpecification("townhouse")).toBe(true);
    expect(plotInSpecification("townhouse")).toBe(false);
  });
});
