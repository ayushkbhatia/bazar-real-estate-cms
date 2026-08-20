import { describe, it, expect } from "vitest";
import { buildHeroSearchUrl } from "./hero-search-config";
import { defaultSearchBar } from "./search-bar";

const HERO_TABS = defaultSearchBar().tabs;
const tab = (v: string) => HERO_TABS.find((t) => t.key === v)!;
const base = { q: "", type: "", beds: "", price: { min: null, max: null }, size: { min: null, max: null } };

describe("HERO_TABS", () => {
  it("is ordered Off-Plan, Buy, Rent, Commercial", () => {
    expect(HERO_TABS.map((t) => t.key)).toEqual([
      "off-plan",
      "buy",
      "rent",
      "commercial",
    ]);
  });

  it("commercial carries the granular type list + size, no beds", () => {
    const c = tab("commercial");
    expect(c.beds).toBe(false);
    expect(c.size?.max).toBe(200_000);
    expect(c.types.map((t) => t.value)).toEqual([
      "land",
      "office",
      "building",
      "retail",
      "commercial_villa",
    ]);
  });

  it("price ceilings match the spec", () => {
    expect(tab("off-plan").price.max).toBe(50_000_000);
    expect(tab("buy").price.max).toBe(50_000_000);
    expect(tab("rent").price.max).toBe(1_000_000);
    expect(tab("commercial").price.max).toBe(200_000_000);
  });
});

describe("buildHeroSearchUrl", () => {
  it("returns the bare route when nothing is set", () => {
    expect(buildHeroSearchUrl(tab("buy"), base)).toBe("/buy");
  });

  it("emits only populated residential fields", () => {
    const url = buildHeroSearchUrl(tab("buy"), {
      ...base,
      q: "  Saadiyat  ",
      type: "villa",
      beds: "3",
      price: { min: null, max: 5_000_000 },
    });
    expect(url).toBe("/buy?q=Saadiyat&type=villa&beds=3&price_max=5000000");
  });

  it("ignores beds for the commercial tab and uses ft² for size", () => {
    const url = buildHeroSearchUrl(tab("commercial"), {
      ...base,
      type: "office",
      beds: "3", // commercial has no beds control — must be dropped
      size: { min: 1_000, max: 20_000 },
      price: { min: null, max: 50_000_000 },
    });
    expect(url).toBe(
      "/commercial?type=office&price_max=50000000&ft2_min=1000&ft2_max=20000",
    );
  });

  it("emits both price bounds when set", () => {
    const url = buildHeroSearchUrl(tab("rent"), {
      ...base,
      price: { min: 50_000, max: 200_000 },
    });
    expect(url).toBe("/rent?price_min=50000&price_max=200000");
  });
});
