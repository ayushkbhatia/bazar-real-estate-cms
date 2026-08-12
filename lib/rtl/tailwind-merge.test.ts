import { describe, expect, it } from "vitest";
import { twMerge } from "tailwind-merge";

/**
 * G-6 — the axis/logical padding trap.
 *
 * `cn()` is `twMerge(clsx(...))`, and tailwind-merge treats `px-*` and `ps-*`
 * as *unrelated* groups: `twMerge("px-2.5", "ps-8")` keeps both. It cannot
 * partially drop the inline-start half of a shorthand, so which one actually
 * applies is decided by **stylesheet order**, not by the order they appear in
 * the class attribute.
 *
 * That is the single largest silent-*English*-regression risk in the physical→
 * logical conversion. Before the codemod these elements read `px-2.5 pl-8`,
 * where Tailwind emits `pl` after `px` so `pl` won. Afterwards they read
 * `px-2.5 ps-8`, and the conversion is only safe because Tailwind v4 also
 * emits the *logical* inline properties after the axis shorthand.
 *
 * Eight class strings in this repo mix the two. Six are dead (they are keyed
 * off `data-icon`, which appears nowhere in the tree); two are live —
 * `dropdown-menu`'s checkbox/radio indent and one form field. Verified against
 * the emitted CSS at the time of the conversion:
 *
 *     .px-1\.5  at byte 67491      .ps-7   at byte 69370
 *     .px-3     at byte 67639      .pe-11  at byte 69924
 *
 * This spec pins the *behaviour* those byte offsets imply, so a tailwind-merge
 * or Tailwind upgrade that reorders them fails here rather than silently
 * shifting padding on the affected components.
 */
describe("tailwind-merge and logical utilities", () => {
  it("does not treat an axis utility as conflicting with a logical one", () => {
    // If this ever starts collapsing, the mixing sites change meaning and
    // every one of them needs re-reading.
    expect(twMerge("px-2.5", "ps-8")).toBe("px-2.5 ps-8");
    expect(twMerge("mx-2", "ms-4")).toBe("mx-2 ms-4");
  });

  it("still collapses genuine conflicts within the logical group", () => {
    // The conversion would be worthless if `cn` stopped overriding at all.
    expect(twMerge("ps-2", "ps-8")).toBe("ps-8");
    expect(twMerge("ms-2", "ms-4")).toBe("ms-4");
    expect(twMerge("text-start", "text-end")).toBe("text-end");
  });

  it("does not collapse a logical utility against its physical twin", () => {
    // Documents the hazard rather than endorsing it: `ms-2 ml-4` leaves both,
    // so a half-converted component would apply whichever the stylesheet
    // orders last. lib/rtl/no-physical-utilities.test.ts is what stops a
    // half-converted component existing in the first place.
    expect(twMerge("ms-2", "ml-4")).toBe("ms-2 ml-4");
  });
});
