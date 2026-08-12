import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AreaCommunities, type BandItem } from "./area-bands";

/**
 * The communities band draws from two sources and must never show both.
 *
 * It used to render project cards *and* the CMS's community names underneath
 * them, headed "Other communities in this area" — which read as the section
 * repeating itself on the three areas that have projects. The rule is now:
 * projects win where they exist, the editorial list carries the band where
 * they don't, and it is never both. That applies to every area guide, present
 * and future, so it is pinned here rather than left to the seed data.
 */

// `img` is the placeholder caption. The seed writes one for every row, and
// without it the caption falls back to the name — which would put the name in
// the DOM twice and make the assertions below ambiguous.
const ITEMS: BandItem[] = [
  { name: "Nawayef Village", img: "nawayef village art" },
  { name: "Nawayef Park Views", img: "nawayef park views art" },
  { name: "Nawayef East", img: "nawayef east art" },
];

const project = (name: string) => <a href={`/developments/${name}`}>{name}</a>;

describe("AreaCommunities", () => {
  it("shows only the project cards when the catalogue has projects", () => {
    render(
      <AreaCommunities
        heading="Explore Hudayriyat Island"
        items={ITEMS}
        projects={[project("al-naseem"), project("bashayer")]}
        projectsTotal={3}
        viewAllHref="/off-plan/search?area=hudayriyat-island"
      />,
    );

    expect(screen.getByText("al-naseem")).toBeTruthy();
    // The editorial names are suppressed — this is the duplication that was
    // reported on /areas/hudayriyat-island.
    expect(screen.queryByText("Nawayef Village")).toBeNull();
    expect(screen.queryByText(/other communities/i)).toBeNull();
  });

  it("falls back to the editorial list when there are no projects", () => {
    // 21 of the 24 areas are in this state. Suppressing the names outright
    // would leave their communities band empty.
    render(<AreaCommunities heading="Explore Corniche" items={ITEMS} />);

    for (const item of ITEMS) {
      expect(screen.getByText(item.name!)).toBeTruthy();
    }
    expect(screen.queryByText(/other communities/i)).toBeNull();
  });

  it("renders nothing at all when neither source has anything", () => {
    const { container } = render(
      <AreaCommunities heading="Explore Somewhere" items={[]} />,
    );
    expect(container.querySelector("section")).toBeNull();
  });

  it("offers the view-all link only when cards are being held back", () => {
    const { rerender, container } = render(
      <AreaCommunities
        heading="Explore Yas Island"
        items={ITEMS}
        projects={[project("yas-park-place")]}
        projectsTotal={3}
        viewAllHref="/off-plan"
      />,
    );
    // One card shown, three exist — the link is worth offering, and names the
    // total rather than what is on screen.
    expect(container.querySelector("a[href='/off-plan']")).toBeTruthy();
    expect(screen.getByText(/view all 3 projects/i)).toBeTruthy();

    // Every project already on screen: a "view all" here goes nowhere new.
    rerender(
      <AreaCommunities
        heading="Explore Hudayriyat Island"
        items={ITEMS}
        projects={[project("a"), project("b"), project("c")]}
        projectsTotal={3}
        viewAllHref="/off-plan"
      />,
    );
    expect(container.querySelector("a[href='/off-plan']")).toBeNull();

    rerender(<AreaCommunities heading="Explore Corniche" items={ITEMS} />);
    expect(container.querySelector("a[href='/off-plan']")).toBeNull();
  });

  it("anchors itself, so the empty sale band can point at it", () => {
    // The sale band's empty state links to #communities when the area has
    // projects but no listings. That anchor has to exist.
    const { container } = render(
      <AreaCommunities heading="Explore X" items={ITEMS} />,
    );
    expect(container.querySelector("section#communities")).toBeTruthy();
  });
});
