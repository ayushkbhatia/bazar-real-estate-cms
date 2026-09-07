import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  MegamenuGroupCard,
  MegamenuGroupCardMobile,
  panelUsesGroupCards,
} from "./megamenu-group-card";
import type { MegamenuColumn, MegamenuTab } from "@/lib/schemas/megamenu";

function column(
  heading: string | null,
  items: { label: string; href: string; badge?: string }[] = [
    { label: "The Artery Residences", href: "/developments/the-artery" },
    { label: "Radiant Terraces", href: "/developments/radiant-terrace" },
  ],
): MegamenuColumn {
  return {
    id: `c-${heading ?? "untitled"}`,
    zone: "right",
    position: 0,
    heading,
    items: items.map((it, i) => ({
      id: `i-${heading}-${i}`,
      position: i,
      label: it.label,
      href: it.href,
      target_kind: "development",
      target_id: null,
      icon: null,
      badge_label: it.badge ?? null,
      badge_variant: "default",
    })),
  } as MegamenuColumn;
}

function tab(right: MegamenuColumn[]): MegamenuTab {
  return {
    id: "tab-areas",
    slug: "areas",
    label: "Areas",
    href: null,
    has_panel: true,
    position: 3,
    panel_title: "Explore by Location",
    panel_title_href: "/areas",
    right_column_title: "Communities by Lifestyle",
    status: "published",
    columns: { left: [], right },
    featured: [],
  } as MegamenuTab;
}

/** Areas' four lifestyles, the shape this treatment exists for. */
const LIFESTYLES = [
  column("Waterfront Communities"),
  column("Gated Communities"),
  column("Luxury Communities"),
  column("Family-Friendly Communities"),
];

/**
 * The predicate is the contract between the two renderers — the desktop panel
 * switches its 2-up card grid on it and the mobile drawer switches its card
 * stack on it. Pinning the threshold here is what stops one tree quietly
 * moving it, which is how the Services zone ended up rendered two different
 * ways before `panelUsesCards` was extracted.
 */
describe("panelUsesGroupCards", () => {
  it("switches a right zone of three-or-more titled groups to cards", () => {
    expect(panelUsesGroupCards(tab(LIFESTYLES))).toBe(true);
    expect(panelUsesGroupCards(tab(LIFESTYLES.slice(0, 3)))).toBe(true);
  });

  it("leaves two titled groups on the generic column renderer", () => {
    // Rent's right zone today. Two blocks read as two blocks unaided; the
    // cards are for the point where a zone becomes a taxonomy.
    expect(panelUsesGroupCards(tab(LIFESTYLES.slice(0, 2)))).toBe(false);
  });

  it("leaves an untitled zone alone however many columns it has", () => {
    // Buy and New Projects: no heading means no group name, and a card around
    // an unnamed column is an empty frame. One untitled column among titled
    // ones is enough to opt the whole zone out — a grid of three cards and one
    // headerless box is worse than the list it replaced.
    expect(panelUsesGroupCards(tab([column(null), column(null), column(null)]))).toBe(
      false,
    );
    expect(
      panelUsesGroupCards(tab([...LIFESTYLES.slice(0, 3), column(null)])),
    ).toBe(false);
  });

  it("is a shape heuristic, not a slug test", () => {
    // Same slug, taxonomy shrunk — Areas drops back to the generic renderer.
    // Different slug, taxonomy grown — that tab picks the cards up with no
    // code change. Slug-hardcoding would freeze the treatment to one tab and
    // quietly skip the next one shaped like it.
    const shrunkAreas = tab(LIFESTYLES.slice(0, 2));
    const grownOther = { ...tab(LIFESTYLES), slug: "rent", label: "Rent" };
    expect(panelUsesGroupCards(shrunkAreas)).toBe(false);
    expect(panelUsesGroupCards(grownOther)).toBe(true);
  });

  it("survives a tab with no right zone at all", () => {
    expect(panelUsesGroupCards(tab([]))).toBe(false);
  });
});

describe("<MegamenuGroupCardMobile>", () => {
  it("names its group and links every item in it", () => {
    render(<MegamenuGroupCardMobile column={column("Gated Communities")} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Gated Communities");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/developments/the-artery");
    expect(links[1]).toHaveAttribute("href", "/developments/radiant-terrace");
  });

  it("keeps the group name out of the links", () => {
    // The regression this whole card exists to prevent is the group name
    // reading as one more entry in the list. A heading that is not inside any
    // link is the structural half of that; the visual half is the header
    // strip. Neither is worth much without the other.
    render(<MegamenuGroupCardMobile column={column("Luxury Communities")} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.textContent).not.toContain("Luxury Communities");
    }
  });

  it("carries an item badge next to its label", () => {
    render(
      <MegamenuGroupCardMobile
        column={column("Waterfront Communities", [
          { label: "Radiant Terraces", href: "/x", badge: "NEW" },
        ])}
      />,
    );
    expect(within(screen.getByRole("link")).getByText("NEW")).toBeTruthy();
  });

  it("survives a group with no items", () => {
    // A column emptied in the CMS renders its header and nothing else, rather
    // than throwing on the way to a nav bar that is on every page.
    const empty = { ...column("Orphan"), items: [] } as MegamenuColumn;
    render(<MegamenuGroupCardMobile column={empty} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Orphan");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("<MegamenuGroupCard>", () => {
  it("shows the same group name and the same links the phone does", () => {
    // The two cards are separate components on purpose — a grid cell and a
    // touch row want different shapes — so the thing worth asserting is that
    // they never disagree about the CONTENT. A link added to one tree and not
    // the other is the drift this catches.
    const col = column("Family-Friendly Communities");
    const { unmount } = render(<MegamenuGroupCard column={col} />);
    const desktop = {
      heading: screen.getByRole("heading").textContent,
      hrefs: screen.getAllByRole("link").map((a) => a.getAttribute("href")),
    };
    unmount();

    render(<MegamenuGroupCardMobile column={col} />);
    expect(screen.getByRole("heading").textContent).toBe(desktop.heading);
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(
      desktop.hrefs,
    );
  });

  it("does not clip a group name wider than its card", () => {
    // Two of Areas' four names overflow a card in the 2-up grid, and the
    // Arabic twin of "Waterfront Communities" is longer still. Truncating the
    // group name would defeat the card, so the header wraps and a min-height
    // keeps the four strips level.
    const { container } = render(
      <MegamenuGroupCard column={column("Family-Friendly Communities")} />,
    );
    const heading = container.querySelector("h4")!;
    expect(heading.className).not.toContain("truncate");
    expect(heading.parentElement!.className).toContain("min-h-");
  });
});
