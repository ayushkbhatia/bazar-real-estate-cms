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

/**
 * The card draws a LIST of labels now — see `site_settings.card_labels` and
 * `lib/card-labels.ts`. The two-prop shorthand stays for the surfaces that
 * have exactly one word to say, so the precedence between the two shapes is
 * the thing worth pinning: a caller migrating from `badge` to `badges` should
 * not have to remember to delete the old prop.
 *
 * No `localStorage` here, deliberately — these assert markup rather than the
 * shortlist button, so they run in environments where that global is missing.
 */
describe("ListingCard labels", () => {
  it("draws every label it is given, in the order given", () => {
    render(
      <ListingCard
        {...props({
          badges: [
            { label: "Exclusive", kind: "ink" },
            { label: "Vacant on transfer", kind: "accent" },
          ],
        })}
      />,
    );
    expect(screen.getByText("Exclusive")).toBeTruthy();
    expect(screen.getByText("Vacant on transfer")).toBeTruthy();
  });

  it("still accepts the single-badge shorthand", () => {
    render(
      <ListingCard {...props({ badge: "Exclusive", badgeKind: "ink" })} />,
    );
    expect(screen.getByText("Exclusive")).toBeTruthy();
  });

  it("lets the list win when a caller passes both", () => {
    render(
      <ListingCard
        {...props({
          badge: "Old",
          badgeKind: "ink",
          badges: [{ label: "New", kind: "success" }],
        })}
      />,
    );
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.queryByText("Old")).toBeNull();
  });

  it("draws nothing when a listing carries no labels", () => {
    const { container } = render(<ListingCard {...props({ badges: [] })} />);
    expect(container.querySelectorAll(".rounded-full").length).toBe(0);
  });

  /** The row variant draws its chips in the body, not over the media, and
   *  folds the two prop shapes through the same helper. */
  it("draws them in the row variant too", () => {
    render(
      <ListingCard
        {...props({
          variant: "row",
          badges: [
            { label: "Exclusive", kind: "ink" },
            { label: "New launch", kind: "success" },
          ],
        })}
      />,
    );
    expect(screen.getByText("Exclusive")).toBeTruthy();
    expect(screen.getByText("New launch")).toBeTruthy();
  });
});
