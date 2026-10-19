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

  it("keeps tenure for every other type, plot or not", () => {
    for (const type of ["apartment", "townhouse", "penthouse", "commercial_villa"]) {
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
    expect(plotInSpecification("townhouse")).toBe(true);
  });
});
