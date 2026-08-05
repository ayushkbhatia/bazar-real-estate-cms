import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { HeroSearch } from "./hero-search";
import { HERO_TABS } from "@/lib/hero-search-config";

/**
 * The hero card was narrowed to 55% of its former desktop width. These specs
 * pin the two invariants that change is allowed to have:
 *   1. the narrowing is `lg:`-only, so every viewport below 1024px renders
 *      exactly as it did before;
 *   2. the mode buttons keep their intrinsic width inside the smaller card.
 */

/** The card's full width before the change; the `lg` cap is 55% of it. */
const FULL_WIDTH_PX = 880;
const NARROW_WIDTH_PX = 484;

function renderCard() {
  const { container } = render(<HeroSearch />);
  const form = container.querySelector("form");
  if (!form) throw new Error("hero search form not found");
  return form;
}

function classes(el: Element): string[] {
  return el.className.split(/\s+/).filter(Boolean);
}

/** Utilities that can affect an element's box width. */
const WIDTH_UTIL = /^(w-|max-w-|min-w-|basis-|flex-|shrink|grow)/;

describe("<HeroSearch> card width", () => {
  it("caps the card at 55% of its former width from lg up", () => {
    expect(NARROW_WIDTH_PX).toBe(Math.round(FULL_WIDTH_PX * 0.55));
    const form = renderCard();
    expect(classes(form)).toContain(`lg:max-w-[${NARROW_WIDTH_PX}px]`);
  });

  it("leaves every breakpoint below lg untouched", () => {
    const form = renderCard();
    const cls = classes(form);

    // The pre-existing base width utilities are still exactly what they were.
    expect(cls).toContain("w-full");
    expect(cls).toContain(`max-w-[${FULL_WIDTH_PX}px]`);

    // `lg:` is the only responsive prefix carrying a width utility, so sm/md
    // (and the base, unprefixed layer) resolve identically to before.
    const responsiveWidthPrefixes = cls
      .filter((c) => c.includes(":"))
      .filter((c) => WIDTH_UTIL.test(c.slice(c.indexOf(":") + 1)))
      .map((c) => c.slice(0, c.indexOf(":")));
    expect(responsiveWidthPrefixes).toEqual(["lg"]);
  });

  it("does not centre the card — it stays flush left as before", () => {
    expect(classes(renderCard())).not.toContain("mx-auto");
  });
});

describe("<HeroSearch> mode buttons", () => {
  function tabButtons() {
    renderCard();
    return screen.getAllByRole("tab");
  }

  it("renders one button per configured tab", () => {
    expect(tabButtons()).toHaveLength(HERO_TABS.length);
  });

  it("pins each button to its intrinsic width so the narrower card cannot squeeze it", () => {
    for (const btn of tabButtons()) {
      const cls = classes(btn);
      expect(cls).toContain("shrink-0");
      expect(cls).toContain("whitespace-nowrap");
      // No explicit width and no flex-grow: the width stays label + padding.
      expect(cls.some((c) => /^(w-|max-w-|min-w-|basis-|flex-1|grow)/.test(c))).toBe(
        false,
      );
    }
  });

  it("keeps the button widths viewport-independent", () => {
    const BREAKPOINT = /^(sm|md|lg|xl|2xl):/;
    for (const btn of tabButtons()) {
      expect(classes(btn).filter((c) => BREAKPOINT.test(c))).toEqual([]);
    }
  });

  it("keeps the padding that defines the intrinsic width", () => {
    for (const btn of tabButtons()) {
      expect(classes(btn)).toContain("px-3.5");
      expect(classes(btn)).toContain("h-8");
    }
  });
});
