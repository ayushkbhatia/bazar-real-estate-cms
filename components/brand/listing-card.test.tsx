import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl as render } from "@/lib/i18n/test-utils";
import { ListingCard, type ListingCardProps } from "./listing-card";

/**
 * The shortlist button is opt-*out*, not opt-in: any surface that hands the
 * card a `propertyId` gets it. That's the whole contract that keeps a page
 * added six months from now from silently shipping unsaveable listings, so
 * it's asserted here rather than left to each call site.
 */
function props(over: Partial<ListingCardProps> = {}): ListingCardProps {
  return {
    price: "AED 4,200,000",
    title: "Three-bedroom on the corniche",
    location: "Al Reem Island",
    beds: 3,
    baths: 4,
    area: 2450,
    ...over,
  };
}

const shortlistButton = () =>
  screen.queryByRole("button", { name: /^(save to|remove from) shortlist$/i });

describe("ListingCard shortlist button", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders by default whenever the card knows its property id", () => {
    render(<ListingCard {...props({ propertyId: "p-1" })} />);
    expect(shortlistButton()).not.toBeNull();
  });

  it.each(["editorial", "row"] as const)(
    "renders on the %s variant too",
    (variant) => {
      render(<ListingCard {...props({ propertyId: "p-1", variant })} />);
      expect(shortlistButton()).not.toBeNull();
    },
  );

  it("renders over a hero image as well as the placeholder", () => {
    render(
      <ListingCard
        {...props({ propertyId: "p-1", heroSrc: "/hero.jpg", heroAlt: "Hero" })}
      />,
    );
    expect(shortlistButton()).not.toBeNull();
  });

  it("is suppressed only when the surface opts out", () => {
    render(
      <ListingCard
        {...props({ propertyId: "p-1", shortlistEnabled: false })}
      />,
    );
    expect(shortlistButton()).toBeNull();
  });

  it("is absent when there is no property id to save", () => {
    render(<ListingCard {...props()} />);
    expect(shortlistButton()).toBeNull();
  });
});
