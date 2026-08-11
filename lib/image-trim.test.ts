import { describe, it, expect } from "vitest";
import { bboxOf, inkCoverage, type Bbox } from "./image-trim";

/** RGBA buffer with `paint(x, y)` returning the alpha to write. */
function canvas(
  width: number,
  height: number,
  paint: (x: number, y: number) => number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[(y * width + x) * 4 + 3] = paint(x, y);
    }
  }
  return data;
}

/** Solid opaque rect, the shape every real logo reduces to. */
function withRect(width: number, height: number, r: Bbox, alpha = 255) {
  return canvas(width, height, (x, y) =>
    x >= r.left && x < r.right && y >= r.top && y < r.bottom ? alpha : 0,
  );
}

describe("bboxOf", () => {
  it("finds a centred rect and reports right/bottom exclusive", () => {
    const rect = { left: 2, top: 3, right: 6, bottom: 7 };
    expect(bboxOf(withRect(10, 10, rect), 10, 10)).toEqual(rect);
  });

  it("returns null for a fully transparent image", () => {
    expect(bboxOf(canvas(8, 8, () => 0), 8, 8)).toBeNull();
  });

  it("returns the whole canvas when the ink already fills it", () => {
    expect(bboxOf(canvas(4, 4, () => 255), 4, 4)).toEqual({
      left: 0,
      top: 0,
      right: 4,
      bottom: 4,
    });
  });

  it("finds ink touching every edge", () => {
    const rect = { left: 0, top: 0, right: 1, bottom: 1 };
    expect(bboxOf(withRect(5, 5, rect), 5, 5)).toEqual(rect);
    const far = { left: 4, top: 4, right: 5, bottom: 5 };
    expect(bboxOf(withRect(5, 5, far), 5, 5)).toEqual(far);
  });

  it("ignores a near-transparent halo below the threshold", () => {
    // Antialiasing leaves alpha 1-4 well outside the visible mark. Counting it
    // would return the whole canvas and silently trim nothing.
    const data = withRect(20, 20, { left: 8, top: 8, right: 12, bottom: 12 });
    data[(0 * 20 + 0) * 4 + 3] = 3;
    data[(19 * 20 + 19) * 4 + 3] = 3;
    expect(bboxOf(data, 20, 20)).toEqual({
      left: 8,
      top: 8,
      right: 12,
      bottom: 12,
    });
  });

  it("respects an explicit threshold", () => {
    const data = withRect(6, 6, { left: 1, top: 1, right: 3, bottom: 3 }, 40);
    expect(bboxOf(data, 6, 6, 8)).toEqual({
      left: 1,
      top: 1,
      right: 3,
      bottom: 3,
    });
    expect(bboxOf(data, 6, 6, 64)).toBeNull();
  });

  it("handles a non-square canvas without transposing the axes", () => {
    const rect = { left: 1, top: 5, right: 3, bottom: 9 };
    expect(bboxOf(withRect(4, 12, rect), 4, 12)).toEqual(rect);
  });
});

describe("inkCoverage", () => {
  it("reports the fraction of the canvas the ink covers", () => {
    expect(
      inkCoverage({ left: 0, top: 0, right: 5, bottom: 5 }, 10, 10),
    ).toBeCloseTo(0.25);
    expect(
      inkCoverage({ left: 0, top: 0, right: 10, bottom: 10 }, 10, 10),
    ).toBe(1);
  });

  it("matches the Bazar logo's measured artboard padding", () => {
    // 1484x1482 of ink on a 5000x5000 canvas — the export that made the logo
    // render at a third of its box.
    const coverage = inkCoverage(
      { left: 1758, top: 1759, right: 3242, bottom: 3241 },
      5000,
      5000,
    );
    expect(coverage).toBeCloseTo(0.088, 3);
  });

  it("is zero for a degenerate canvas rather than NaN", () => {
    expect(inkCoverage({ left: 0, top: 0, right: 0, bottom: 0 }, 0, 0)).toBe(0);
  });
});
