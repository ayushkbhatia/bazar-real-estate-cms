import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RendersGallery, type RenderTile } from "./renders-gallery";

function tiles(n: number, prefix: string): RenderTile[] {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://cdn.test/${prefix}-${i}.jpg`,
    alt: `${prefix} ${i}`,
    caption: null,
  }));
}

const BLANK = {
  eyebrow: null,
  heading: null,
  intro: null,
  interiorHeading: null,
  exteriorHeading: null,
};

function grid(): HTMLElement {
  // The wrapper that carries the split — the element holding both halves.
  return document.querySelector("h2")!.parentElement!.querySelector(
    ".grid",
  ) as HTMLElement;
}

describe("renders gallery", () => {
  it("puts the two halves side by side when both have imagery", () => {
    render(
      <RendersGallery
        {...BLANK}
        interior={tiles(3, "int")}
        exterior={tiles(3, "ext")}
      />,
    );
    expect(screen.getByRole("heading", { name: "Interior" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Exterior" })).toBeInTheDocument();
    expect(grid().className).toContain("md:grid-cols-2");
  });

  it("drops the empty half and lets the other span the width", () => {
    // Every project in the catalogue is in this state today: exteriors only.
    render(<RendersGallery {...BLANK} interior={[]} exterior={tiles(4, "ext")} />);
    expect(screen.getByRole("heading", { name: "Exterior" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Interior" })).toBeNull();
    expect(grid().className).not.toContain("md:grid-cols-2");
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  it("renders nothing at all when neither half has imagery", () => {
    const { container } = render(
      <RendersGallery {...BLANK} interior={[]} exterior={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps each half's images inside its own column", () => {
    render(
      <RendersGallery
        {...BLANK}
        interior={tiles(2, "int")}
        exterior={tiles(3, "ext")}
      />,
    );
    const interior = screen
      .getByRole("heading", { name: "Interior" })
      .closest("section")!;
    expect(within(interior).getAllByRole("img")).toHaveLength(2);
    for (const img of within(interior).getAllByRole("img")) {
      expect(img.getAttribute("alt")).toMatch(/^int /);
    }
  });

  it("takes the editor's copy overrides, including per-column headings", () => {
    render(
      <RendersGallery
        eyebrow="Inside and out"
        heading="How it will look"
        intro="Artist's impressions, not photographs."
        interiorHeading="Inside"
        exteriorHeading="Outside"
        interior={tiles(1, "int")}
        exterior={tiles(1, "ext")}
      />,
    );
    expect(screen.getByText("Inside and out")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "How it will look" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Artist's impressions, not photographs."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inside" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Outside" })).toBeInTheDocument();
  });

  it("shows the caption an editor typed against an image", () => {
    // The field has been storable since the gallery shipped; nothing read it.
    render(
      <RendersGallery
        {...BLANK}
        interior={[]}
        exterior={[
          { url: "https://cdn.test/a.jpg", alt: "Pool", caption: "Pool deck" },
        ]}
      />,
    );
    expect(screen.getByText("Pool deck")).toBeInTheDocument();
  });

  it("fills the last row of a half rather than leaving one square hanging", () => {
    // First tile always leads the column. With an even total the remainder is
    // odd, so the closer widens too and no row comes out half-empty.
    const { container } = render(
      <RendersGallery
        {...BLANK}
        interior={tiles(4, "int")}
        exterior={tiles(3, "ext")}
      />,
    );
    const half = (name: string) =>
      [
        ...screen
          .getByRole("heading", { name })
          .closest("section")!
          .querySelectorAll("figure"),
      ].map((f) => f.className.includes("col-span-2"));
    expect(half("Interior")).toEqual([true, false, false, true]);
    // An odd total already comes out as a lead plus clean pairs.
    expect(half("Exterior")).toEqual([true, false, false]);
    expect(container.querySelectorAll("figure")).toHaveLength(7);
  });

  it("widens a lone column to four tracks so its tiles stay page-sized", () => {
    // At full width a two-track mosaic stretches every tile to ~1300px and the
    // section runs to thousands of pixels. Four tracks keep the lead tile a
    // 2×2 block with squares packed beside it.
    const { container } = render(
      <RendersGallery {...BLANK} interior={[]} exterior={tiles(6, "ext")} />,
    );
    const mosaic = container.querySelector("section > div.grid")!;
    expect(mosaic.className).toContain("md:grid-cols-4");
    const lead = container.querySelector("figure")!;
    expect(lead.className).toContain("col-span-2");
    expect(lead.className).toContain("md:row-span-2");
    // The closer stays square — four tracks absorb the remainder on their own.
    const figures = [...container.querySelectorAll("figure")];
    expect(figures.at(-1)!.className).not.toContain("col-span-2");
  });

  it("keeps a half's mosaic to two tracks", () => {
    const { container } = render(
      <RendersGallery
        {...BLANK}
        interior={tiles(3, "int")}
        exterior={tiles(3, "ext")}
      />,
    );
    for (const mosaic of container.querySelectorAll("section > div.grid")) {
      expect(mosaic.className).not.toContain("md:grid-cols-4");
    }
  });
});
