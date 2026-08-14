import { describe, it, expect } from "vitest";
import { buildOffplanMap, parseGroupLimit } from "./offplan-map";
import type { DevelopmentIndexRow } from "./developments";

/** Minimal published-development row for the pure transform. */
function dev(
  over: Partial<DevelopmentIndexRow> &
    Pick<DevelopmentIndexRow, "id" | "slug" | "name">,
): DevelopmentIndexRow {
  return {
    status: "on_sale",
    handover_date: null,
    total_units: null,
    starting_price: null,
    tagline: null,
    bedrooms_text: null,
    description: null,
    developer: null,
    area: null,
    hero: null,
    ...over,
  };
}

const SAADIYAT = { name: "Saadiyat Island", slug: "saadiyat-island" };
const YAS = { name: "Yas Island", slug: "yas-island" };

describe("buildOffplanMap", () => {
  const rows = [
    dev({
      id: "1",
      slug: "bulgari",
      name: "Bulgari",
      area: SAADIYAT,
      starting_price: 9_500_000,
    }),
    dev({ id: "2", slug: "mandarin", name: "Mandarin", area: SAADIYAT }),
    dev({ id: "3", slug: "bayviews", name: "Bayviews", area: SAADIYAT }),
    dev({
      id: "4",
      slug: "solaya",
      name: "Solaya",
      area: YAS,
      developer: { name: "Aldar", slug: "aldar" },
    }),
  ];

  it("groups projects by area with counts, busiest first", () => {
    const { groups } = buildOffplanMap(rows);
    expect(groups.map((g) => [g.slug, g.count])).toEqual([
      ["saadiyat-island", 3],
      ["yas-island", 1],
    ]);
  });

  it("emits one pin per area with count = project count and no price stats", () => {
    const { pins } = buildOffplanMap(rows);
    const saadiyat = pins.find((p) => p.slug === "saadiyat-island");
    expect(saadiyat?.count).toBe(3);
    expect(saadiyat?.medianPerFt2).toBeNull();
    expect(saadiyat?.yoyChange).toBeNull();
    expect(saadiyat?.emirate).toBe("abu-dhabi");
  });

  it("emits one dot per project and fans co-located projects apart", () => {
    const { dots } = buildOffplanMap(rows);
    expect(dots).toHaveLength(4);
    const saadiyatDots = dots.filter((d) =>
      ["bulgari", "mandarin", "bayviews"].includes(d.slug),
    );
    const coords = new Set(saadiyatDots.map((d) => `${d.lng},${d.lat}`));
    expect(coords.size).toBe(3); // no two projects stacked on one point
  });

  it("places a solo project on its area centroid (no jitter)", () => {
    const { dots } = buildOffplanMap(rows);
    const solaya = dots.find((d) => d.slug === "solaya")!;
    // Yas centroid from the shared table.
    expect(solaya.lng).toBeCloseTo(54.605, 3);
    expect(solaya.lat).toBeCloseTo(24.488, 3);
  });

  // The popup formats these; an unpriced project carries 0, not null, because
  // MapLibre's tile encoder does not round-trip nulls.
  it("carries a dot's raw price, with 0 for unpriced", () => {
    const { dots } = buildOffplanMap(rows);
    expect(dots.find((d) => d.slug === "bulgari")?.priceAed).toBe(9_500_000);
    expect(dots.find((d) => d.slug === "mandarin")?.priceAed).toBe(0);
  });

  it("gives a project its own subtitle, since it has no beds or area", () => {
    const { dots } = buildOffplanMap(rows);
    const bulgari = dots.find((d) => d.slug === "bulgari")!;
    expect(bulgari.beds).toBeNull();
    expect(bulgari.builtUpFt2).toBeNull();
    // Area name alone when the project has no developer attached.
    expect(bulgari.metaText).toBe("Saadiyat Island");
    // "Developer · Area" when it does.
    expect(dots.find((d) => d.slug === "solaya")?.metaText).toBe(
      "Aldar · Yas Island",
    );
  });

  it("builds a flat option list for the lead-form picker", () => {
    const { options } = buildOffplanMap(rows);
    expect(options).toHaveLength(4);
    expect(options.find((o) => o.id === "4")).toEqual({
      id: "4",
      name: "Solaya",
      areaName: "Yas Island",
    });
  });

  it("puts a project on its own CMS pin, not on the area ring", () => {
    const { dots } = buildOffplanMap(rows, {
      "1": { lat: 24.5384, lng: 54.4183 },
    });
    const bulgari = dots.find((d) => d.slug === "bulgari")!;
    expect(bulgari.lat).toBeCloseTo(24.5384, 4);
    expect(bulgari.lng).toBeCloseTo(54.4183, 4);
  });

  it("keeps fanning the projects that have no pin yet", () => {
    const { dots } = buildOffplanMap(rows, {
      "1": { lat: 24.5384, lng: 54.4183 },
    });
    const rest = dots.filter((d) => ["mandarin", "bayviews"].includes(d.slug));
    // Two un-pinned projects → a two-point ring, not three points minus one.
    expect(rest.map((d) => d.lng)).toEqual([54.435 + 0.011, 54.435 - 0.011]);
    expect(new Set(rest.map((d) => `${d.lng},${d.lat}`)).size).toBe(2);
  });

  it("moves the area pin onto the cluster its projects actually sit in", () => {
    const { pins } = buildOffplanMap(rows, {
      "4": { lat: 24.5186, lng: 54.6024 },
    });
    const yas = pins.find((p) => p.slug === "yas-island")!;
    expect(yas.lat).toBeCloseTo(24.5186, 4);
    expect(yas.lng).toBeCloseTo(54.6024, 4);
    // Untouched areas keep the centroid they had before.
    const saadiyat = pins.find((p) => p.slug === "saadiyat-island")!;
    expect(saadiyat.lng).toBeCloseTo(54.435, 6);
    expect(saadiyat.lat).toBeCloseTo(24.545, 6);
  });

  it("maps an area with no known centroid once a project is pinned there", () => {
    const extra = dev({
      id: "7",
      slug: "placed",
      name: "Placed",
      area: { name: "Nowhere", slug: "nowhere" },
    });
    const { pins, dots, groups } = buildOffplanMap([...rows, extra], {
      "7": { lat: 24.41, lng: 54.51 },
    });
    expect(dots.find((d) => d.slug === "placed")?.lat).toBeCloseTo(24.41, 4);
    expect(pins.find((p) => p.slug === "nowhere")?.lng).toBeCloseTo(54.51, 4);
    expect(groups.map((g) => g.slug)).toContain("nowhere");
  });

  it("ignores a malformed or out-of-range pin and falls back to the ring", () => {
    const { dots } = buildOffplanMap(rows, {
      "4": { lat: 999, lng: 54.6 },
      "1": { lat: Number.NaN, lng: 54.4 },
    });
    const solaya = dots.find((d) => d.slug === "solaya")!;
    expect(solaya.lng).toBeCloseTo(54.605, 3);
    expect(solaya.lat).toBeCloseTo(24.488, 3);
    // Bulgari is back on the three-project Saadiyat ring.
    expect(dots.find((d) => d.slug === "bulgari")!.lng).toBeCloseTo(
      54.435 + 0.011,
      6,
    );
  });

  it("drops projects with no area or an unknown centroid from the map", () => {
    const { pins, dots, groups, options } = buildOffplanMap([
      ...rows,
      dev({ id: "5", slug: "orphan", name: "Orphan", area: null }),
      dev({
        id: "6",
        slug: "unknown",
        name: "Unknown",
        area: { name: "Nowhere", slug: "nowhere" },
      }),
    ]);
    expect(pins.map((p) => p.slug)).not.toContain("nowhere");
    expect(dots.map((d) => d.slug)).not.toContain("orphan");
    expect(dots.map((d) => d.slug)).not.toContain("unknown");
    expect(groups.map((g) => g.slug)).not.toContain("nowhere");
    // …but they remain selectable in the form (the whole catalogue).
    expect(options).toHaveLength(6);
  });
});

describe("parseGroupLimit", () => {
  it("reads a positive whole number", () => {
    expect(parseGroupLimit("12")).toBe(12);
    expect(parseGroupLimit("  6 ")).toBe(6);
  });

  it("treats anything that isn't one as no cap, so a rail is never empty", () => {
    // The master-page editor has no number field, so this is free text and an
    // editor can type whatever they like into it.
    for (const bad of [
      null,
      undefined,
      "",
      "   ",
      "0",
      "-3",
      "twelve",
      "3.5",
      "1e3",
    ]) {
      expect(
        parseGroupLimit(bad),
        `${JSON.stringify(bad)} should mean no cap`,
      ).toBeNull();
    }
  });
});
