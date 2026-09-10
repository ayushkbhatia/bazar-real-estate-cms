import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl as render } from "@/lib/i18n/test-utils";
import { CardRail } from "./card-rail";

/**
 * The rail is what keeps the launches band to one screen on a phone. jsdom
 * applies no CSS and computes no layout, so two different things are asserted
 * two different ways:
 *
 *  - the arrows react to overflow geometry, which is stubbed onto the track —
 *    that is the only input they have, and stubbing it is what lets the
 *    disabled edges be asserted at all;
 *  - the breakpoint is a CLASS, and a class-name assertion is the only thing
 *    that can hold it. Every rail utility here is unprefixed and every desktop
 *    one is `md:`, which together are the whole of the "phone only" claim —
 *    the same contract `hero-search.test.tsx` pins for the collapsed search.
 */
const build = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    key: `d${i}`,
    node: <div>Development {i}</div>,
  }));

function setup(itemCount = 6) {
  render(<CardRail label="Abu Dhabi's latest launches." items={build(itemCount)} />);
  return screen.getByTestId("card-rail-track");
}

/** Pretend the track is one card wide with six cards in it. */
function stubGeometry(
  track: HTMLElement,
  { clientWidth = 358, scrollWidth = 1927, scrollLeft = 0 } = {},
) {
  for (const [prop, value] of [
    ["clientWidth", clientWidth],
    ["scrollWidth", scrollWidth],
  ] as const) {
    Object.defineProperty(track, prop, { value, configurable: true });
  }
  // Writable, because the smooth-scroll fallback assigns to scrollLeft on a
  // timer that can outlive the assertion — a read-only stub turns that into an
  // unhandled exception after the test has finished.
  Object.defineProperty(track, "scrollLeft", {
    value: scrollLeft,
    configurable: true,
    writable: true,
  });
  fireEvent.scroll(track);
}

describe("<CardRail>", () => {
  it("renders every card it is given", () => {
    setup();
    expect(screen.getAllByText(/^Development \d$/)).toHaveLength(6);
  });

  it("is a rail below `md` and the grid it always was from `md` up", () => {
    const track = setup();
    const classes = track.className.split(/\s+/);
    // Below md: a scrolling, snapping flex row of 86%-wide cards.
    expect(classes).toContain("flex");
    expect(classes).toContain("overflow-x-auto");
    expect(classes).toContain("snap-x");
    expect(classes).toContain("[&>*]:w-[86%]");
    // From md: the grid, with the cards back to their track width.
    expect(classes).toContain("md:grid");
    expect(classes).toContain("md:overflow-visible");
    expect(classes).toContain("md:[&>*]:w-auto");
  });

  it("keeps the arrows off desktop, where the track does not scroll", () => {
    const track = setup();
    stubGeometry(track);
    expect(screen.getByTestId("card-rail-prev").parentElement).toHaveClass(
      "md:hidden",
    );
  });

  it("draws no arrows at all when everything already fits", () => {
    const track = setup(2);
    stubGeometry(track, { clientWidth: 358, scrollWidth: 358 });
    expect(screen.queryByTestId("card-rail-prev")).toBeNull();
    expect(screen.queryByTestId("card-rail-next")).toBeNull();
  });

  it("disables the back arrow at the start of the rail", () => {
    const track = setup();
    stubGeometry(track);
    expect(screen.getByTestId("card-rail-prev")).toBeDisabled();
    expect(screen.getByTestId("card-rail-next")).toBeEnabled();
  });

  it("disables the forward arrow at the end of the rail", () => {
    const track = setup();
    stubGeometry(track, { scrollLeft: 1569 });
    expect(screen.getByTestId("card-rail-prev")).toBeEnabled();
    expect(screen.getByTestId("card-rail-next")).toBeDisabled();
  });

  it("advances one card, not one viewport", () => {
    // The next card is already a sliver in view, so a viewport-sized page
    // would skip most of it. One card is what the eye is following.
    const track = setup();
    const scrollTo = vi.fn();
    Object.defineProperty(track, "scrollTo", { value: scrollTo, configurable: true });
    const card = track.firstElementChild as HTMLElement;
    Object.defineProperty(card, "offsetWidth", { value: 308, configurable: true });
    stubGeometry(track);

    fireEvent.click(screen.getByTestId("card-rail-next"));
    // jsdom reports no computed column-gap, so the stride is the card alone.
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 308 }),
    );
  });

  it("names the rail for a screen reader", () => {
    setup();
    expect(
      screen.getByRole("group", { name: "Abu Dhabi's latest launches." }),
    ).toBeInTheDocument();
  });
});
