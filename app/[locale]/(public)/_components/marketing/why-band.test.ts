import { describe, expect, it } from "vitest";
import { keepFigureWithUnit } from "./why-band";

describe("keepFigureWithUnit", () => {
  it("binds the figure to the Arabic word after it, not the one before", () => {
    expect(keepFigureWithUnit("أكثر من 20 عامًا")).toBe("أكثر من 20 عامًا");
  });

  it("handles a figure with a suffix and English copy", () => {
    expect(keepFigureWithUnit("20+ Years")).toBe("20+ Years");
    expect(keepFigureWithUnit("Over 20 Years")).toBe("Over 20 Years");
  });

  it("leaves copy without a figure, or with a trailing one, alone", () => {
    expect(keepFigureWithUnit("وصول مباشر")).toBe("وصول مباشر");
    expect(keepFigureWithUnit("Since 2004")).toBe("Since 2004");
  });
});
