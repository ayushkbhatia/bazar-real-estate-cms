import { describe, it, expect } from "vitest";
import { buildOffplanMap, parseGroupLimit } from "./offplan-map";
import type { DevelopmentIndexRow } from "./developments";

/** Minimal published-development row for the pure transform. */
function dev(
  over: Partial<DevelopmentIndexRow> & Pick<DevelopmentIndexRow, "id" | "slug" | "name">,
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
    dev({ id: "1", slug: "bulgari", name: "Bulgari", area: SAADIYAT, starting_price: 9_500_000 }),
    dev({ id: "2", slug: "mandarin", name: "Mandarin", area: SAADIYAT }),
    dev({ id: "3", slug: "bayviews", name: "Bayviews", area: SAADIYAT }),
    dev({ id: "4", slug: "solaya", name: "Solaya", area: YAS, developer: { name: "Aldar", slug: "aldar" } }),
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

  it("formats a dot's price and falls back when unpriced", () => {
    const { dots } = buildOffplanMap(rows);
    expect(dots.find((d) => d.slug === "bulgari")?.price).toBe("AED 9.5M");
    expect(dots.find((d) => d.slug === "mandarin")?.price).toBe("Price on request");
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

  it("drops projects with no area or an unknown centroid from the map", () => {
    const { pins, dots, groups, options } = buildOffplanMap([
      ...rows,
      dev({ id: "5", slug: "orphan", name: "Orphan", area: null }),
      dev({ id: "6", slug: "unknown", name: "Unknown", area: { name: "Nowhere", slug: "nowhere" } }),
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
    for (const bad of [null, undefined, "", "   ", "0", "-3", "twelve", "3.5", "1e3"]) {
      expect(parseGroupLimit(bad), `${JSON.stringify(bad)} should mean no cap`).toBeNull();
    }
  });
});
