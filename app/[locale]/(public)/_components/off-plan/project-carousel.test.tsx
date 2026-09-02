import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProjectCarousel } from "./project-carousel";

/**
 * The rail is what keeps an area with thirty projects to one row. jsdom has no
 * layout, so the overflow geometry is stubbed onto the track — that is the
 * only input the arrows react to, and stubbing it is what lets the disabled
 * edges be asserted at all.
 */
const build = (n: number, hiddenFrom = Infinity) =>
  Array.from({ length: n }, (_, i) => ({
    key: `p${i}`,
    node: <div>Project {i}</div>,
    hidden: i >= hiddenFrom,
  }));

function setup(
  overrides: {
    count?: number;
    itemCount?: number;
    hiddenFrom?: number;
    resetKey?: string | null;
  } = {},
) {
  const view = render(
    <ProjectCarousel
      name="Yas Island"
      count={overrides.count ?? 9}
      items={build(overrides.itemCount ?? 9, overrides.hiddenFrom)}
      viewAllHref="/off-plan/search?area=yas-island"
      resetKey={overrides.resetKey ?? null}
    />,
  );
  return Object.assign(screen.getByTestId("carousel-track-Yas Island"), {
    rerenderWith: view.rerender,
  });
}

/** Pretend the rail is three cards wide with nine cards in it. */
function stubGeometry(
  track: HTMLElement,
  { clientWidth = 900, scrollWidth = 2700, scrollLeft = 0 } = {},
) {
  for (const [prop, value] of [
    ["clientWidth", clientWidth],
    ["scrollWidth", scrollWidth],
  ] as const) {
    Object.defineProperty(track, prop, { value, configurable: true });
  }
  // Writable, because the carousel's smooth-scroll fallback assigns to
  // scrollLeft on a timer that can outlive the assertion — a read-only stub
  // turns that into an unhandled exception after the test has finished.
  Object.defineProperty(track, "scrollLeft", {
    value: scrollLeft,
    configurable: true,
    writable: true,
  });
  fireEvent.scroll(track);
}

describe("ProjectCarousel", () => {
  it("renders every project it is given on a single rail", () => {
    setup();
    expect(screen.getAllByText(/^Project \d$/)).toHaveLength(9);
  });

  it("keeps filtered-out cards in the DOM, hidden", () => {
    // Filtering to an area must not drop the other areas' cards: they carry
    // the only links to those projects in this section, and re-rendering them
    // on every chip click would throw away server-rendered HTML for nothing.
    setup({ itemCount: 9, hiddenFrom: 3 });
    const cards = screen.getAllByText(/^Project \d$/);
    expect(cards).toHaveLength(9);
    const hidden = cards.filter((c) => c.parentElement?.hasAttribute("hidden"));
    expect(hidden).toHaveLength(6);
  });

  it("rewinds to the first card when the selection changes", () => {
    // A rail parked three cards along, then filtered to an area with two,
    // would sit past the end of its own contents and read as empty.
    const track = setup({ resetKey: null });
    Object.defineProperty(track, "scrollLeft", {
      value: 900,
      configurable: true,
      writable: true,
    });
    track.rerenderWith(
      <ProjectCarousel
        name="Yas Island"
        count={9}
        items={build(9, 3)}
        viewAllHref="/off-plan/search?area=yas-island"
        resetKey="yas-island"
      />,
    );
    expect(track.scrollLeft).toBe(0);
  });

  it("shows the true published count, not the number of cards", () => {
    // An area capped at 9 cards still says how many projects it really has —
    // otherwise the "view all" link has nothing to promise.
    setup({ count: 30 });
    expect(screen.getByText("30 projects")).toBeInTheDocument();
  });

  it("says 'project' when there is only one", () => {
    setup({ count: 1, itemCount: 1 });
    expect(screen.getByText("1 project")).toBeInTheDocument();
  });

  it("hides the arrows when everything already fits", () => {
    const track = setup({ itemCount: 2 });
    stubGeometry(track, { clientWidth: 900, scrollWidth: 900 });
    expect(screen.queryByTestId("carousel-next-Yas Island")).toBeNull();
    expect(screen.queryByTestId("carousel-prev-Yas Island")).toBeNull();
  });

  it("disables the back arrow at the start of the rail", () => {
    const track = setup();
    stubGeometry(track);
    expect(screen.getByTestId("carousel-prev-Yas Island")).toBeDisabled();
    expect(screen.getByTestId("carousel-next-Yas Island")).toBeEnabled();
  });

  it("disables the forward arrow at the end of the rail", () => {
    const track = setup();
    stubGeometry(track, { scrollLeft: 1800 });
    expect(screen.getByTestId("carousel-prev-Yas Island")).toBeEnabled();
    expect(screen.getByTestId("carousel-next-Yas Island")).toBeDisabled();
  });

  it("advances exactly one viewport — three cards on desktop, one on a phone", () => {
    const track = setup();
    const scrollTo = vi.fn();
    Object.defineProperty(track, "scrollTo", {
      value: scrollTo,
      configurable: true,
    });
    stubGeometry(track);

    fireEvent.click(screen.getByTestId("carousel-next-Yas Island"));
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 900 }),
    );

    // Back only works once there is something behind us — at scrollLeft 0 the
    // arrow is disabled, so move the rail before asking it to go back.
    stubGeometry(track, { scrollLeft: 900 });
    fireEvent.click(screen.getByTestId("carousel-prev-Yas Island"));
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ left: 0 }),
    );
  });

  it("never scrolls past the end of the rail", () => {
    const track = setup();
    const scrollTo = vi.fn();
    Object.defineProperty(track, "scrollTo", {
      value: scrollTo,
      configurable: true,
    });
    // One viewport from the end: a full page forward would overshoot by 900.
    stubGeometry(track, { scrollLeft: 1500 });

    fireEvent.click(screen.getByTestId("carousel-next-Yas Island"));
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 1800 }),
    );
  });

  it("lands the scroll anyway when the engine ignores smooth behaviour", () => {
    // Some embedded browsers accept scrollTo({behavior:'smooth'}) and simply
    // never animate, which would leave these arrows dead.
    vi.useFakeTimers();
    try {
      const track = setup();
      Object.defineProperty(track, "scrollTo", {
        value: vi.fn(), // accepts the call, moves nothing
        configurable: true,
      });
      // scrollLeft has to be an accessor here, so define it instead of going
      // through stubGeometry (which installs plain read-only values).
      const setScrollLeft = vi.fn();
      Object.defineProperty(track, "clientWidth", { value: 900, configurable: true });
      Object.defineProperty(track, "scrollWidth", { value: 2700, configurable: true });
      Object.defineProperty(track, "scrollLeft", {
        get: () => 0,
        set: setScrollLeft,
        configurable: true,
      });
      fireEvent.scroll(track);

      fireEvent.click(screen.getByTestId("carousel-next-Yas Island"));
      expect(setScrollLeft).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(setScrollLeft).toHaveBeenCalledWith(900);
    } finally {
      vi.useRealTimers();
    }
  });

  it("links out to the area's full result set", () => {
    setup();
    expect(screen.getByRole("link", { name: /View all in Yas Island/ })).toHaveAttribute(
      "href",
      "/off-plan/search?area=yas-island",
    );
  });
});
