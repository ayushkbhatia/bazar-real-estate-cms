import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MEGAMENU_CARD_ICONS,
  MEGAMENU_CARD_ICON_FALLBACK,
  MegamenuServiceCard,
  MegamenuServiceCardMobile,
  panelUsesCards,
} from "./megamenu-service-card";
import type { MegamenuColumn, MegamenuTab } from "@/lib/schemas/megamenu";

function column(
  heading: string,
  over: { icon?: string | null; label?: string; href?: string } = {},
): MegamenuColumn {
  return {
    id: `c-${heading}`,
    zone: "left",
    position: 0,
    heading,
    items: [
      {
        id: `i-${heading}`,
        position: 0,
        label: over.label ?? "Find the right residential opportunity.",
        href: over.href ?? "/services/buy",
        target_kind: "service",
        target_id: null,
        icon: over.icon === undefined ? "search" : over.icon,
        badge_label: null,
        badge_variant: "default",
      },
    ],
  } as MegamenuColumn;
}

function tab(leftCount: number): MegamenuTab {
  return {
    id: "tab-1",
    slug: "services",
    label: "Services",
    href: null,
    has_panel: true,
    position: 0,
    panel_title: "Our Services",
    panel_title_href: "/services",
    right_column_title: null,
    status: "published",
    columns: {
      left: Array.from({ length: leftCount }, (_, i) => column(`Service ${i}`)),
      right: [],
    },
    featured: [],
  } as MegamenuTab;
}

/**
 * The predicate is the contract between the two renderers: the desktop panel
 * switches its 3-up grid on it and the mobile drawer switches its card stack
 * on it. Before it was extracted only the desktop had an answer, which is how
 * Services arrived on a phone as plain text. Pinning the threshold here is
 * what stops one tree quietly moving it.
 */
describe("panelUsesCards", () => {
  it("leaves a sparse left zone on the generic column renderer", () => {
    expect(panelUsesCards(tab(4))).toBe(false);
  });

  it("switches a dense left zone to cards", () => {
    expect(panelUsesCards(tab(5))).toBe(true);
    expect(panelUsesCards(tab(6))).toBe(true);
  });

  it("is a column-count heuristic, not a slug test", () => {
    // Same slug, too few columns — a tab that stops being dense stops being
    // cards, and a differently-named tab that becomes dense starts being them.
    const sparseServices = tab(2);
    const denseOther = { ...tab(6), slug: "advisory", label: "Advisory" };
    expect(panelUsesCards(sparseServices)).toBe(false);
    expect(panelUsesCards(denseOther)).toBe(true);
  });
});

describe("MEGAMENU_CARD_ICONS", () => {
  it("carries a distinct glyph for every icon 0048 writes", () => {
    // The six strings the Services migration sets. A rename on either side
    // silently drops the card back to the fallback, which looks like a design
    // regression rather than a missing key.
    const written = [
      "search",
      "tag",
      "key-round",
      "clipboard-list",
      "building-2",
      "landmark",
    ];
    for (const key of written) expect(MEGAMENU_CARD_ICONS[key]).toBeTruthy();
    expect(new Set(written.map((k) => MEGAMENU_CARD_ICONS[k])).size).toBe(
      written.length,
    );
  });

  it("has a fallback distinct from every mapped glyph", () => {
    expect(MEGAMENU_CARD_ICON_FALLBACK).toBeTruthy();
    expect(Object.values(MEGAMENU_CARD_ICONS)).not.toContain(
      MEGAMENU_CARD_ICON_FALLBACK,
    );
  });
});

describe("card icon resolution", () => {
  it("draws the fallback when the column names an icon we do not carry", () => {
    const { container } = render(
      <MegamenuServiceCardMobile column={column("Buy", { icon: "nope" })} />,
    );
    expect(container.querySelector(".lucide-compass")).not.toBeNull();
  });

  it("draws the named glyph when we do", () => {
    const { container } = render(
      <MegamenuServiceCardMobile column={column("Buy", { icon: "landmark" })} />,
    );
    expect(container.querySelector(".lucide-landmark")).not.toBeNull();
  });
});

describe("<MegamenuServiceCardMobile>", () => {
  it("carries the heading, the blurb and the item's href", () => {
    render(
      <MegamenuServiceCardMobile
        column={column("Sell Your Property", {
          label: "Market and sell your property.",
          href: "/services/sell",
        })}
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/services/sell");
    expect(link.textContent).toContain("Sell Your Property");
    expect(link.textContent).toContain("Market and sell your property.");
  });

  it("shows the same heading and blurb the desktop card does", () => {
    const col = column("Property Management", {
      label: "Managing properties with ongoing care.",
      href: "/services/manage",
    });
    const { unmount } = render(<MegamenuServiceCard column={col} />);
    const desktop = screen.getByRole("link").textContent;
    unmount();
    render(<MegamenuServiceCardMobile column={col} />);
    expect(screen.getByRole("link").textContent).toBe(desktop);
  });

  it("survives a column with no items at all", () => {
    const empty = { ...column("Orphan"), items: [] } as MegamenuColumn;
    render(<MegamenuServiceCardMobile column={empty} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "#");
  });
});
