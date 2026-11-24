import { describe, expect, it } from "vitest";
import {
  expertiseCardsFrom,
  expertiseGrid,
  resolveExpertiseTiles,
  wantsCounts,
} from "./expertise-cards";
import type { AreaCardRecord } from "@/lib/queries/area-cards";

const records = new Map<string, AreaCardRecord>([
  ["khalifa-city", { slug: "khalifa-city", name: "Khalifa City", heroUrl: "https://cdn/kc.jpg", count: 5 }],
  ["al-bateen", { slug: "al-bateen", name: "البطين", heroUrl: null }],
]);

describe("resolveExpertiseTiles", () => {
  it("fills every blank from the area: name, area page, hero photo", () => {
    const [tile] = resolveExpertiseTiles([{ slug: "khalifa-city" }], records, "Explore Homes");
    expect(tile).toMatchObject({
      name: "Khalifa City",
      href: "/areas/khalifa-city",
      imgUrl: "https://cdn/kc.jpg",
      countLabel: "Explore Homes",
    });
  });

  it("lets the card's own words, link and image win", () => {
    const [tile] = resolveExpertiseTiles(
      [{ slug: "khalifa-city", name: "KC", href: "/buy/search?area=khalifa-city", imageUrl: "https://cdn/own.jpg", subtitle: "Villas" }],
      records,
      "Explore Homes",
    );
    expect(tile).toMatchObject({ name: "KC", href: "/buy/search?area=khalifa-city", imgUrl: "https://cdn/own.jpg", countLabel: "Villas" });
  });

  it("fills {count} with the live count", () => {
    const [tile] = resolveExpertiseTiles([{ slug: "khalifa-city", subtitle: "{count} homes" }], records, "x");
    expect(tile!.countLabel).toBe("5 homes");
  });

  it("matches a slug typed with capitals", () => {
    expect(resolveExpertiseTiles([{ slug: "Khalifa-City" }], records, "x")[0]!.name).toBe("Khalifa City");
  });

  it("uses the area's localised name", () => {
    expect(resolveExpertiseTiles([{ slug: "al-bateen" }], records, "x")[0]!.name).toBe("البطين");
  });

  it("drops a switched-off card and one whose area is gone with nothing of its own", () => {
    const tiles = resolveExpertiseTiles(
      [{ slug: "khalifa-city", enabled: false }, { slug: "deleted-area" }, { slug: "deleted-area", name: "Old", href: "/old" }],
      records,
      "x",
    );
    expect(tiles.map((t) => t.name)).toEqual(["Old"]);
  });
});

describe("wantsCounts", () => {
  it("is true only when a shown card asks for {count}", () => {
    expect(wantsCounts([{ subtitle: "Explore" }])).toBe(false);
    expect(wantsCounts([{ subtitle: "{count} homes", enabled: false }])).toBe(false);
    expect(wantsCounts([{ subtitle: "{count} homes" }])).toBe(true);
  });
});

describe("expertiseGrid", () => {
  it("lays seven out as one large tile beside a 3×2 grid", () => {
    expect(expertiseGrid(7)).toEqual({
      columns: "minmax(0,1.725fr) repeat(3,minmax(0,1fr))",
      rows: "repeat(2,minmax(0,1fr))",
    });
  });

  it("keeps the home band's 1.15 : 2 ratio at four columns", () => {
    expect(expertiseGrid(9).columns).toBe("minmax(0,2.3fr) repeat(4,minmax(0,1fr))");
  });

  it("uses one row for up to three beside the large tile, and none for one card", () => {
    expect(expertiseGrid(3).rows).toBe("repeat(1,minmax(0,1fr))");
    expect(expertiseGrid(1)).toEqual({ columns: "minmax(0,1fr)", rows: "minmax(0,1fr)" });
  });
});

describe("expertiseCardsFrom", () => {
  it("reads a resolved section's cards, image included", () => {
    expect(
      expertiseCardsFrom([
        { enabled: true, slug: "al-bateen", name: null, image: { url: "https://cdn/a.jpg", alt: "Alt", label: null } },
        "junk",
      ]),
    ).toEqual([
      {
        enabled: true,
        slug: "al-bateen",
        name: null,
        subtitle: null,
        href: null,
        imageUrl: "https://cdn/a.jpg",
        imageAlt: "Alt",
        imageLabel: null,
      },
    ]);
  });
});
