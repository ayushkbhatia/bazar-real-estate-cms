import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/lib/i18n/test-utils";
import { TESTIMONIALS_MAX } from "@/lib/master-pages/library";
import type { Testimonial } from "@/lib/seeds/awards";
import { TestimonialCarousel, unwrapQuote } from "./testimonial-carousel";
import { HomeTestimonials } from "./home-testimonials";

/**
 * The section's whole reason to exist is that it is no longer three-up: an
 * editor can put twelve reviews in the CMS and see twelve. These assert the two
 * halves of that — that nothing slices the list on the way to the DOM, and that
 * the repeated copies the seamless loop needs stay out of the accessibility
 * tree instead of announcing every quote six times.
 */

const review = (id: string): Testimonial => ({
  id,
  quote: `Quote ${id}`,
  attribution: `Client ${id}`,
});

const reviews = (n: number) =>
  Array.from({ length: n }, (_, i) => review(String(i)));

/** The cards a screen reader is offered — duplicates are aria-hidden. */
function announced(): HTMLElement[] {
  return screen
    .getAllByRole("figure", { hidden: true })
    .filter((el) => el.getAttribute("aria-hidden") !== "true");
}

describe("TestimonialCarousel", () => {
  it("renders every review it is handed, well past the old cap of three", () => {
    renderWithIntl(<TestimonialCarousel items={reviews(12)} />);
    expect(announced()).toHaveLength(12);
    expect(
      announced().map((el) => within(el).getByRole("blockquote").textContent),
    ).toEqual(reviews(12).map((r) => `“Quote ${r.id}”`));
  });

  /**
   * The -50% translate only looks seamless if the second half of the track is
   * pixel-identical to the first, which needs an even number of copies. Three
   * reviews also have to be repeated before one copy is wider than a desktop
   * viewport — otherwise the track slides off and leaves a hole.
   */
  it("repeats the set an even number of times so the loop has no seam", () => {
    for (const n of [1, 2, 3, 5, 6, 7, 12]) {
      const { unmount } = renderWithIntl(
        <TestimonialCarousel items={reviews(n)} />,
      );
      const total = screen.getAllByRole("figure", { hidden: true }).length;
      const copies = total / n;
      expect(Number.isInteger(copies)).toBe(true);
      expect(copies % 2).toBe(0);
      // One copy has to overflow on its own — see REPEAT_UNTIL.
      expect((copies / 2) * n).toBeGreaterThanOrEqual(6);
      unmount();
    }
  });

  it("hides the duplicate copies from assistive tech", () => {
    renderWithIntl(<TestimonialCarousel items={reviews(6)} />);
    const all = screen.getAllByRole("figure", { hidden: true });
    expect(all).toHaveLength(12);
    expect(all.filter((el) => el.getAttribute("aria-hidden") === "true"))
      .toHaveLength(6);
  });

  it("slows down as the list grows, rather than sprinting through it", () => {
    const read = (n: number) => {
      const { container, unmount } = renderWithIntl(
        <TestimonialCarousel items={reviews(n)} />,
      );
      const rail = container.querySelector(".bz-treviews") as HTMLElement;
      const value = rail.style.getPropertyValue("--bz-treviews-duration");
      unmount();
      return Number.parseInt(value, 10);
    };
    expect(read(12)).toBeGreaterThan(read(6));
  });

  it("renders nothing at all when there are no reviews", () => {
    const { container } = renderWithIntl(<TestimonialCarousel items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("HomeTestimonials", () => {
  it("shows the whole list when no limit is set — the point of the carousel", () => {
    renderWithIntl(<HomeTestimonials items={reviews(9)} />);
    expect(announced()).toHaveLength(9);
  });

  it("honours the master page's count when one is chosen", () => {
    renderWithIntl(<HomeTestimonials items={reviews(9)} limit={4} />);
    expect(announced()).toHaveLength(4);
  });

  it("clamps a stored count to what the list can hold", () => {
    renderWithIntl(
      <HomeTestimonials items={reviews(9)} limit={TESTIMONIALS_MAX + 50} />,
    );
    expect(announced()).toHaveLength(9);
  });
});

/**
 * The card draws its own quote marks, and the field's help has always said so.
 * Every review in production carries typed ones anyway, so the home page has
 * been rendering ““…”” — see the note on QUOTE_PAIRS.
 */
describe("unwrapQuote", () => {
  it("drops marks the editor typed, whichever pair they used", () => {
    expect(unwrapQuote("\u201CThey told us to walk away.\u201D")).toBe(
      "They told us to walk away.",
    );
    expect(unwrapQuote('"They told us to walk away."')).toBe(
      "They told us to walk away.",
    );
    expect(unwrapQuote("\u00ABقالوا لنا أن ننسحب.\u00BB")).toBe(
      "قالوا لنا أن ننسحب.",
    );
  });

  it("leaves a quote that merely contains one", () => {
    const q = "They said \u201Cwalk away\u201D and they were right.";
    expect(unwrapQuote(q)).toBe(q);
  });

  it("leaves an unwrapped quote untouched beyond trimming", () => {
    expect(unwrapQuote("  They told us to walk away.  ")).toBe(
      "They told us to walk away.",
    );
  });

  it("does not eat a lone quote character", () => {
    expect(unwrapQuote('"')).toBe('"');
  });
});

describe("the rendered card", () => {
  it("wraps each quote exactly once", () => {
    renderWithIntl(
      <TestimonialCarousel
        items={[{ id: "a", quote: "\u201CTyped their own.\u201D", attribution: "Client A" }]}
      />,
    );
    expect(announced()[0]!.querySelector("blockquote")!.textContent).toBe(
      "\u201CTyped their own.\u201D",
    );
  });
});
