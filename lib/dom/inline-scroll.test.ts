import { describe, expect, it } from "vitest";
import {
  clampInlineScroll,
  inlineScrollStart,
  maxInlineScroll,
  toScrollLeft,
} from "./inline-scroll";

/**
 * The scroll bug these exist to prevent, stated as arithmetic.
 *
 * In the CSSOM-View model an RTL container reports `scrollLeft === 0` at the
 * inline start and counts negative toward the end. The failure is not that
 * things mirror — it is that LTR-shaped code *degenerates*: comparisons pin to
 * one answer and the clamp collapses the range to a point.
 */
function fakeEl(scrollLeft: number, scrollWidth = 900, clientWidth = 300) {
  return { scrollLeft, scrollWidth, clientWidth } as HTMLElement;
}

describe("inline scroll coordinates", () => {
  it("is the identity in LTR, so existing behaviour is untouched", () => {
    const el = fakeEl(150);
    expect(inlineScrollStart(el, false)).toBe(150);
    expect(toScrollLeft(150, false)).toBe(150);
  });

  it("normalises RTL's negative scrollLeft to a positive offset", () => {
    // Same visual position as the LTR case above, opposite sign.
    const el = fakeEl(-150);
    expect(inlineScrollStart(el, true)).toBe(150);
  });

  it("round-trips in both directions", () => {
    for (const rtl of [true, false]) {
      for (const offset of [0, 1, 150, 600]) {
        const el = fakeEl(toScrollLeft(offset, rtl));
        expect(inlineScrollStart(el, rtl)).toBe(offset);
      }
    }
  });

  it("reports the same max regardless of direction", () => {
    expect(maxInlineScroll(fakeEl(0))).toBe(600);
    expect(maxInlineScroll(fakeEl(-600))).toBe(600);
  });

  describe("the arrow-state bug", () => {
    const max = 600;

    it("pins canPrev false and canNext true when read raw in RTL", () => {
      // What the code did before: both arrows lit, rail frozen on page one.
      for (const scrollLeft of [0, -300, -600]) {
        const el = fakeEl(scrollLeft);
        expect(el.scrollLeft > 1, "canPrev, read raw").toBe(false);
        expect(el.scrollLeft < max - 1, "canNext, read raw").toBe(true);
      }
    });

    it("gives the right answer at both ends once normalised", () => {
      const start = inlineScrollStart(fakeEl(0), true);
      expect(start > 1).toBe(false); // nothing before the start
      expect(start < max - 1).toBe(true); // more to come

      const end = inlineScrollStart(fakeEl(-600), true);
      expect(end > 1).toBe(true); // can go back
      expect(end < max - 1).toBe(false); // nothing after the end
    });
  });

  describe("the clamp collapse", () => {
    it("collapses the usable range to a point when applied raw in RTL", () => {
      // Math.max(0, …) over a [-600, 0] range leaves only 0 reachable, which
      // is why paging appeared to do nothing.
      const from = -300;
      const naive = Math.max(0, Math.min(600, from + 300));
      expect(naive).toBe(0);
    });

    it("pages correctly in logical space", () => {
      const el = fakeEl(toScrollLeft(300, true));
      const from = inlineScrollStart(el, true);
      const next = clampInlineScroll(from + 300, maxInlineScroll(el));
      expect(next).toBe(600);
      // One conversion, at the point of assignment.
      expect(toScrollLeft(next, true)).toBe(-600);
    });

    it("does not scroll past either end", () => {
      expect(clampInlineScroll(-50, 600)).toBe(0);
      expect(clampInlineScroll(900, 600)).toBe(600);
    });
  });
});
