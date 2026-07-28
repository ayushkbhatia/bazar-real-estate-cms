import { describe, it, expect } from "vitest";
import {
  HOME_AREA_TILE_COUNT,
  HOME_OFFPLAN_CARD_COUNT,
} from "@/app/(public)/_components/home/section-copy";

type SeedItem = { name: string; href: string; slug: string };

/**
 * Mirrors the seed construction in this route. The bug it guards against: the
 * editor offering to load *every* published development (8) into a section the
 * home page renders 3 of, so the admin list and the live page disagreed the
 * moment you used it.
 */
function buildSeeds(input: {
  areas: SeedItem[];
  /** Published developments, newest first — the page's own order. */
  developments: SeedItem[];
}) {
  return {
    areas: {
      options: input.areas,
      current: input.areas.slice(0, HOME_AREA_TILE_COUNT),
    },
    developments: {
      options: [...input.developments].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      current: input.developments.slice(0, HOME_OFFPLAN_CARD_COUNT),
    },
  };
}

const item = (name: string): SeedItem => ({
  name,
  href: `/developments/${name}`,
  slug: name,
});

const EIGHT = [
  "solaya-by-aldar",
  "reem-hills-phase-4",
  "six-senses-residences",
  "bayviews-saadiyat",
  "bulgari-residences",
  "mandarin-oriental",
  "saadiyat-lagoons",
  "mamsha-al-saadiyat",
].map(item);

describe("master-page seeds", () => {
  it("seeds the off-plan list with what the home page renders, not the catalogue", () => {
    const seeds = buildSeeds({ areas: [], developments: EIGHT });
    expect(seeds.developments.current).toHaveLength(HOME_OFFPLAN_CARD_COUNT);
    expect(seeds.developments.current.map((d) => d.slug)).toEqual([
      "solaya-by-aldar",
      "reem-hills-phase-4",
      "six-senses-residences",
    ]);
  });

  it("still offers every published project in the picker", () => {
    const seeds = buildSeeds({ areas: [], developments: EIGHT });
    expect(seeds.developments.options).toHaveLength(EIGHT.length);
    // Alphabetical, because a dropdown of eight is scanned, not scrolled.
    expect(seeds.developments.options[0].name).toBe("bayviews-saadiyat");
  });

  it("cuts the area seed to the number of tiles the section shows", () => {
    const areas = Array.from({ length: 20 }, (_, i) => item(`area-${i}`));
    const seeds = buildSeeds({ areas, developments: [] });
    expect(seeds.areas.current).toHaveLength(HOME_AREA_TILE_COUNT);
    expect(seeds.areas.options).toHaveLength(20);
  });

  it("copes with fewer records than the cut", () => {
    const seeds = buildSeeds({ areas: [item("a")], developments: [item("d")] });
    expect(seeds.areas.current).toHaveLength(1);
    expect(seeds.developments.current).toHaveLength(1);
  });
});
