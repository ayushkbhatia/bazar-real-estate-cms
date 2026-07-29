import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MegamenuTile } from "./megamenu-tile";
import type { MegamenuFeaturedTile } from "@/lib/schemas/megamenu";

function tile(over: Partial<MegamenuFeaturedTile> = {}): MegamenuFeaturedTile {
  return {
    id: "t-1",
    position: 0,
    variant: "dark",
    badge_label: null,
    badge_kind: "none",
    headline: "Solaya by Aldar",
    href: "/developments/solaya-by-aldar",
    media_asset_id: null,
    media_url: null,
    cta_label: "Discover more",
    ...over,
  } as MegamenuFeaturedTile;
}

/** The tile's outer <a>, which carries the colour classes. */
function root() {
  return screen.getByRole("link");
}

describe("<MegamenuTile> headline colour", () => {
  it("renders white text on the dark choice", () => {
    render(<MegamenuTile tile={tile({ variant: "dark" })} />);
    expect(root().className).toContain("text-white");
  });

  it("renders ink text on the light choice", () => {
    render(<MegamenuTile tile={tile({ variant: "light" })} />);
    expect(root().className).toContain("text-bz-ink");
    expect(root().className).not.toContain("text-white");
  });

  it("treats the legacy image variant as white", () => {
    // Rows predating the colour control carry variant="image"; they read as
    // white, which is what they already rendered.
    render(<MegamenuTile tile={tile({ variant: "image" })} />);
    expect(root().className).toContain("text-white");
  });
});

describe("<MegamenuTile> with a picked image", () => {
  const withImage = (variant: MegamenuFeaturedTile["variant"]) =>
    tile({ variant, media_url: "https://cdn.test/tile.jpg" });

  it("renders the image", () => {
    render(<MegamenuTile tile={withImage("dark")} />);
    const img = document.querySelector("img");
    expect(img).not.toBeNull();
    // Decorative — the headline already carries the meaning.
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("darkens behind white text and lightens behind black text", () => {
    const { unmount } = render(<MegamenuTile tile={withImage("dark")} />);
    expect(document.body.innerHTML).toContain("from-bz-navy/60");
    unmount();

    render(<MegamenuTile tile={withImage("light")} />);
    // A navy wash under black text is exactly the unreadable case this
    // control exists to fix.
    expect(document.body.innerHTML).toContain("from-white/75");
    expect(document.body.innerHTML).not.toContain("from-bz-navy/60");
  });

  it("falls back to the pattern when no image is set", () => {
    render(<MegamenuTile tile={tile()} />);
    expect(document.querySelector("img")).toBeNull();
  });
});
