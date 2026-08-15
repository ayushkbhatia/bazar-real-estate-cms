import { describe, it, expect } from "vitest";
import type { ComparableProperty } from "@/lib/queries/compare";
import {
  buildAttributeGroups,
  listedAge,
  rowDiffers,
  unionAmenities,
} from "./compare";

function p(
  overrides: Partial<ComparableProperty> = {},
): ComparableProperty {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    reference: "BAZ-AD-04891",
    slug: "mamsha-3-bed",
    title: "Mamsha 3-bed",
    price_aed: 4_200_000,
    mode: "buy",
    status: "published",
    type: "apartment",
    beds: 3,
    baths: 4,
    built_up_ft2: 2_180,
    plot_ft2: null,
    floor: 7,
    year_built: 2022,
    tenure: "freehold",
    furnishing: "unfurnished",
    view: "Sea",
    parking_bays: 2,
    service_charge_per_ft2: 16,
    amenities: ["Private beach", "Concierge", "Gym & spa"],
    flags: { exclusive: true, vacant_on_transfer: true },
    published_at: "2026-05-17T00:00:00Z",
    created_at: "2026-05-17T00:00:00Z",
    area_name: "Saadiyat Island",
    area_slug: "saadiyat-island",
    hero: null,
    ...overrides,
  };
}


describe("enum cells", () => {
  it("emits the enum as a message key rather than English", () => {
    // `modeLabel`/`typeLabel`/`tenureLabel`/`furnishingLabel` used to turn
    // these into prose inside a file whose header says "no React, no DB".
    // The words are the caller's now; the model emits the key.
    const [priceTerms, specs] = buildAttributeGroups([p()]);
    const cell = (g: typeof priceTerms, key: string) =>
      g.rows.find((r) => r.key === key)!.values[0];
    expect(cell(priceTerms!, "mode")).toEqual({ kind: "msg", key: "mode.buy" });
    expect(cell(priceTerms!, "tenure")).toEqual({
      kind: "msg",
      key: "tenure.freehold",
    });
    expect(cell(specs!, "type")).toEqual({
      kind: "msg",
      key: "type.apartment",
    });
    expect(cell(specs!, "furnishing")).toEqual({
      kind: "msg",
      key: "furnishing.unfurnished",
    });
  });

  it("carries the floor as a count, not as the words 'Floor 7'", () => {
    // The noun used to be baked in, which put a translatable word inside the
    // value two properties are diffed on.
    const [, specs] = buildAttributeGroups([p({ floor: 7 })]);
    expect(specs!.rows.find((r) => r.key === "floor")!.values[0]).toEqual({
      kind: "msg",
      key: "floorValue",
      count: 7,
    });
  });

  it("diffs a message cell on its key and count, not its rendered text", () => {
    // Otherwise the highlighting would depend on the visitor's language, the
    // way it once depended on their currency.
    expect(
      rowDiffers([
        { kind: "msg", key: "floorValue", count: 7 },
        { kind: "msg", key: "floorValue", count: 9 },
      ]),
    ).toBe(true);
    expect(
      rowDiffers([
        { kind: "msg", key: "mode.buy" },
        { kind: "msg", key: "mode.buy" },
      ]),
    ).toBe(false);
  });
});

describe("listedAge", () => {
  const NOW = new Date("2026-05-21T12:00:00Z").getTime();

  it("returns a unit and a count, so the caller can pluralise", () => {
    expect(listedAge("2026-05-19T12:00:00Z", NOW)).toEqual({ unit: "day", n: 2 });
    expect(listedAge("2026-05-20T12:00:00Z", NOW)).toEqual({ unit: "day", n: 1 });
    expect(listedAge("2026-05-21T12:00:00Z", NOW)).toEqual({ unit: "day", n: 0 });
    expect(listedAge("2026-02-21T12:00:00Z", NOW)).toEqual({ unit: "month", n: 2 });
    expect(listedAge("2024-05-21T12:00:00Z", NOW)).toEqual({ unit: "year", n: 2 });
  });

  it("returns em-dash when never published", () => {
    expect(listedAge(null, NOW)).toBeNull();
  });
});

describe("rowDiffers", () => {
  it("is false when all non-null values agree", () => {
    expect(rowDiffers(["A", "A", "A"])).toBe(false);
    expect(rowDiffers(["A", null, "A"])).toBe(false);
    expect(rowDiffers([1, 1, 1, null])).toBe(false);
  });
  it("is true as soon as one non-null value diverges", () => {
    expect(rowDiffers(["A", "B"])).toBe(true);
    expect(rowDiffers([1, 1, 2])).toBe(true);
    expect(rowDiffers([true, false])).toBe(true);
  });
  it("is false for a single value (nothing to compare against)", () => {
    expect(rowDiffers(["A"])).toBe(false);
    expect(rowDiffers([null])).toBe(false);
  });
});

describe("unionAmenities", () => {
  it("dedupes case-insensitively and sorts alphabetically", () => {
    const result = unionAmenities([
      p({ amenities: ["Concierge", "Private pool", "Gym"] }),
      p({ amenities: ["Private Pool", "Beach access", "concierge"] }),
    ]);
    expect(result).toEqual([
      "Beach access",
      "Concierge",
      "Gym",
      "Private pool",
    ]);
  });
  it("returns an empty array when nothing is listed", () => {
    expect(unionAmenities([p({ amenities: [] })])).toEqual([]);
  });
});

describe("buildAttributeGroups", () => {
  const NOW = new Date("2026-05-21T12:00:00Z").getTime();

  it("emits the 5 expected groups in order", () => {
    const groups = buildAttributeGroups([p(), p({ id: "x" })], NOW);
    expect(groups.map((g) => g.key)).toEqual([
      "price_terms",
      "specifications",
      "location",
      "amenities",
      "investment",
    ]);
  });

  it("flags 'differs' on rows where two cells disagree", () => {
    const groups = buildAttributeGroups(
      [
        p({ id: "1", beds: 3, price_aed: 4_200_000 }),
        p({ id: "2", beds: 5, price_aed: 12_800_000 }),
      ],
      NOW,
    );
    const specs = groups.find((g) => g.key === "specifications")!;
    const beds = specs.rows.find((r) => r.key === "beds")!;
    expect(beds.differs).toBe(true);

    const priceTerms = groups.find((g) => g.key === "price_terms")!;
    const ask = priceTerms.rows.find((r) => r.key === "asking_price")!;
    expect(ask.differs).toBe(true);
  });

  it("does NOT flag 'differs' on rows where everything is the same", () => {
    const groups = buildAttributeGroups([p(), p({ id: "x" })], NOW);
    const tenure = groups
      .find((g) => g.key === "price_terms")!
      .rows.find((r) => r.key === "tenure")!;
    expect(tenure.differs).toBe(false);
  });

  // Money and areas travel as raw numbers tagged with their storage unit —
  // the page renders them in the visitor's currency and area unit.
  it("carries price per area as a raw AED/ft² figure, null when unknown", () => {
    const groups = buildAttributeGroups(
      [
        p({ price_aed: 4_200_000, built_up_ft2: 2_180 }),
        p({ id: "x", price_aed: 12_800_000, built_up_ft2: null }),
      ],
      NOW,
    );
    const ppf = groups
      .find((g) => g.key === "price_terms")!
      .rows.find((r) => r.key === "ppf")!;
    expect(ppf.values[0]).toEqual({ kind: "aedPerFt2", value: 1_927 });
    expect(ppf.values[1]).toEqual({ kind: "aedPerFt2", value: null });
  });

  it("tags the money and area cells with their storage unit", () => {
    const groups = buildAttributeGroups([p({ price_aed: 4_200_000 })], NOW);
    const rowFor = (group: string, key: string) =>
      groups.find((g) => g.key === group)!.rows.find((r) => r.key === key)!;
    expect(rowFor("price_terms", "asking_price").values[0]).toEqual({
      kind: "aed",
      value: 4_200_000,
    });
    expect(rowFor("price_terms", "service_charge").values[0]).toEqual({
      kind: "aedPerFt2",
      value: 16,
      per: "yr",
    });
    expect(rowFor("specifications", "built_up").values[0]).toEqual({
      kind: "ft2",
      value: 2_180,
    });
  });

  // Diffing the rendered string made 4,201,000 and 4,204,000 read as
  // identical ("AED 4.20M" both) and would have made the highlight depend on
  // the visitor's currency.
  it("diffs money on the raw figure, not on its rounded label", () => {
    const groups = buildAttributeGroups(
      [p({ price_aed: 4_201_000 }), p({ id: "x", price_aed: 4_204_000 })],
      NOW,
    );
    const ask = groups
      .find((g) => g.key === "price_terms")!
      .rows.find((r) => r.key === "asking_price")!;
    expect(ask.differs).toBe(true);
  });

  it("produces one boolean row per unioned amenity", () => {
    const groups = buildAttributeGroups(
      [
        p({ amenities: ["Private beach", "Gym"] }),
        p({ id: "x", amenities: ["Private pool", "Gym"] }),
      ],
      NOW,
    );
    const amenityRows = groups.find((g) => g.key === "amenities")!.rows;
    const keys = amenityRows.map((r) => r.key);
    expect(keys).toEqual([
      "amenity::gym",
      "amenity::private beach",
      "amenity::private pool",
    ]);
    const gym = amenityRows.find((r) => r.key === "amenity::gym")!;
    expect(gym.values).toEqual([true, true]);
    expect(gym.differs).toBe(false);

    const pool = amenityRows.find(
      (r) => r.key === "amenity::private pool",
    )!;
    expect(pool.values).toEqual([false, true]);
    expect(pool.differs).toBe(true);
  });

  it("falls back to a count row when no amenities are listed", () => {
    const groups = buildAttributeGroups(
      [p({ amenities: [] }), p({ id: "x", amenities: [] })],
      NOW,
    );
    const amenities = groups.find((g) => g.key === "amenities")!;
    expect(amenities.rows).toHaveLength(1);
    expect(amenities.rows[0].key).toBe("amenity_count");
  });

  it("returns an empty array for zero comparables", () => {
    expect(buildAttributeGroups([], NOW)).toEqual([]);
  });
});
