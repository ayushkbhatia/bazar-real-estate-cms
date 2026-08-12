import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PropTypeGrid, type PropType } from "./prop-type-grid";

/**
 * `sizes` is what picks the entry out of `srcset`, so it has to describe the
 * slot the card actually occupies. It was once a fixed string ending in
 * `20vw`: correct for the five-column grid on /off-plan, and wrong for the
 * three-column one on /buy and /rent, which asked for a 20vw image and then
 * stretched it across a 33vw card. Same upload, sharp on one page and soft on
 * the other two — so this is asserted per column count.
 */
const items: PropType[] = [
  {
    name: "Apartments",
    desc: "City living",
    imgUrl: "https://example.test/apartments.jpg",
    imgAlt: "Apartments",
  },
];

/** Scoped to this render's own container — the loop below renders repeatedly. */
function sizesOf(cols: 3 | 4 | 5): string {
  const { container } = render(<PropTypeGrid items={items} cols={cols} />);
  return container.querySelector("img")?.getAttribute("sizes") ?? "";
}

describe("PropTypeGrid image sizes", () => {
  it("asks for a third of the row at three columns", () => {
    expect(sizesOf(3)).toBe(
      "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 34vw",
    );
  });

  it("asks for a quarter at four", () => {
    expect(sizesOf(4)).toBe(
      "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
    );
  });

  it("leaves the five-column grid exactly as it was — /off-plan was correct", () => {
    expect(sizesOf(5)).toBe(
      "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw",
    );
  });

  it("never asks for less than the card is wide", () => {
    // The grids sit in a full-bleed container, so a card is
    // (100vw - padding - gaps) / cols — always a shade under 100/cols.
    for (const cols of [3, 4, 5] as const) {
      const declared = Number(sizesOf(cols).match(/(\d+)vw$/)![1]);
      expect(declared).toBeGreaterThanOrEqual(100 / cols);
    }
  });
});
