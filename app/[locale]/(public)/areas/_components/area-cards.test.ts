import { describe, expect, it } from "vitest";
import { cardCount } from "./area-cards";

const counts = new Map([
  ["saadiyat-island", 8],
  ["khalifa-city", 5],
  ["zayed-city", 10],
]);

describe("cardCount", () => {
  it("matches a slug typed with capitals", () => {
    expect(cardCount({ slug: "Saadiyat-Island", href: null }, counts)).toBe(8);
  });

  it("counts the area the card links to over a stale slug", () => {
    expect(
      cardCount({ slug: "khalifa-city", href: "/areas/zayed-city" }, counts),
    ).toBe(10);
    expect(
      cardCount(
        { slug: "khalifa-city", href: "/ar/areas/zayed-city/" },
        counts,
      ),
    ).toBe(10);
  });

  it("falls back to the slug when the link is not an area page", () => {
    expect(cardCount({ slug: "khalifa-city", href: "/buy" }, counts)).toBe(5);
  });

  it("is undefined when neither names a known area", () => {
    expect(
      cardCount({ slug: "nowhere", href: "/buy" }, counts),
    ).toBeUndefined();
  });
});
