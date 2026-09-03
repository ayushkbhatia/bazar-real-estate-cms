import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl as render } from "@/lib/i18n/test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { HeroSearch } from "./hero-search";
import { defaultSearchBar } from "@/lib/search-bar";
import { PreferencesProvider } from "@/lib/preferences";

const BAR = defaultSearchBar();

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
  // The size slider labels itself in the visitor's area unit, so the hero
  // reads `usePreferences` and needs the provider the public layout supplies.
  const { container } = render(
    <PreferencesProvider>
      <HeroSearch tabs={BAR.tabs} copy={BAR.copy} />
    </PreferencesProvider>,
  );
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
    expect(tabButtons()).toHaveLength(BAR.tabs.length);
  });

  it("pins each button to its intrinsic width so the narrower card cannot squeeze it", () => {
    for (const btn of tabButtons()) {
      const cls = classes(btn);
      expect(cls).toContain("shrink-0");
      expect(cls).toContain("whitespace-nowrap");
      // No explicit width and no flex-grow: the width stays label + padding.
      expect(
        cls.some((c) => /^(w-|max-w-|min-w-|basis-|flex-1|grow)/.test(c)),
      ).toBe(false);
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

/**
 * The phone's collapsed state. At 375px the console measured 441px of an
 * 861px hero — it covered the video the hero exists to show — so below `md`
 * it now rests as a single search-bar-shaped button and unfolds on tap.
 *
 * These specs pin the one invariant that change is allowed to have: every
 * part of it is `md:`-scoped, so from `md` up the browser draws exactly what
 * it drew before. jsdom applies no CSS, which is precisely why the assertions
 * are on the classes — the breakpoint IS the contract here, and a class-name
 * assertion is the only thing that can hold it.
 */
describe("<HeroSearch> collapsed on phones", () => {
  function parts() {
    const form = renderCard();
    const trigger = form.querySelector("button[aria-expanded]");
    const panelId = trigger?.getAttribute("aria-controls") ?? "";
    const panel = panelId
      ? form.querySelector(`#${CSS.escape(panelId)}`)
      : null;
    return { form, trigger, panel };
  }

  it("rests as a single trigger, with the console folded away", () => {
    const { trigger, panel } = parts();
    expect(trigger).not.toBeNull();
    expect(classes(trigger!)).toContain("md:hidden");
    // Folded by a class, not unmounted: the tab list and the ranges keep
    // their state across a collapse, and the query field stays focusable.
    expect(classes(panel!)).toContain("hidden");
  });

  it("unfolds the console when the trigger is tapped", () => {
    const { trigger, form } = parts();
    fireEvent.click(trigger!);
    expect(form.querySelector("button[aria-expanded]")).toBeNull();
    const panel = form.querySelector(
      `#${CSS.escape(trigger!.getAttribute("aria-controls")!)}`,
    );
    expect(classes(panel!)).not.toContain("hidden");
  });

  it("folds it back from the close control", () => {
    const { trigger, form } = parts();
    fireEvent.click(trigger!);
    const close = form.querySelector("button[aria-label]");
    fireEvent.click(close!);
    expect(form.querySelector("button[aria-expanded]")).not.toBeNull();
  });

  it("leaves the desktop console exactly where it was", () => {
    const { trigger, panel, form } = parts();
    // The trigger is drawn only below `md`; the console only from `md` up
    // when it is folded. Together those two classes are the whole of the
    // "mobile only" claim — neither state can reach a desktop viewport.
    expect(classes(trigger!)).toContain("md:hidden");
    expect(classes(panel!)).toContain("md:block");
    // The close control lives in a `md:hidden` row, so the desktop console
    // gains no chrome it did not have.
    fireEvent.click(trigger!);
    const close = form.querySelector("button[aria-label]");
    expect(classes(close!.parentElement!)).toContain("md:hidden");
  });

  it("keeps both phone-only controls above the 44px touch floor", () => {
    const { trigger, form } = parts();
    // WCAG 2.5.5, and the blocking `touchTargets` check in
    // e2e/mobile-geometry.spec.ts. h-12 = 48px, h-11/w-11 = 44px.
    expect(classes(trigger!)).toContain("h-12");
    fireEvent.click(trigger!);
    const close = form.querySelector("button[aria-label]");
    expect(classes(close!)).toContain("h-11");
    expect(classes(close!)).toContain("w-11");
  });
});
