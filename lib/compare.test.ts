import { describe, it, expect } from "vitest";
import type { ComparableProperty } from "@/lib/queries/compare";
import {
  buildAttributeGroups,
  formatAed,
  formatFt2,
  listedDays,
  modeLabel,
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

describe("formatAed", () => {
  it("formats millions to 2 d.p., thousands to whole K", () => {
    expect(formatAed(4_200_000)).toBe("AED 4.20M");
    expect(formatAed(750_000)).toBe("AED 750K");
    expect(formatAed(500)).toBe("AED 500");
  });
  it("returns em-dash for null", () => {
    expect(formatAed(null)).toBe("—");
  });
});

describe("formatFt2", () => {
  it("includes thousands separators and the ft² suffix", () => {
    expect(formatFt2(2_180)).toBe("2,180 ft²");
  });
  it("returns em-dash for null", () => {
    expect(formatFt2(null)).toBe("—");
  });
});

describe("modeLabel", () => {
  it("disambiguates buy as 'Buy · resale' for the comparison table", () => {
    expect(modeLabel("buy")).toBe("Buy · resale");
    expect(modeLabel("off_plan")).toBe("Off-plan");
  });
});

describe("listedDays", () => {
  const NOW = new Date("2026-05-21T12:00:00Z").getTime();

  it("returns days for recent listings, months/years for older ones", () => {
    expect(listedDays("2026-05-19T12:00:00Z", NOW)).toBe("2 days ago");
    expect(listedDays("2026-05-20T12:00:00Z", NOW)).toBe("1 day ago");
    expect(listedDays("2026-05-21T12:00:00Z", NOW)).toBe("today");
    expect(listedDays("2026-02-21T12:00:00Z", NOW)).toBe("2 mo ago");
    expect(listedDays("2024-05-21T12:00:00Z", NOW)).toBe("2 yr ago");
  });

  it("returns em-dash when never published", () => {
    expect(listedDays(null, NOW)).toBe("—");
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

  it("renders price per ft² when built-up is set, em-dash when missing", () => {
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
    expect(ppf.values[0]).toBe("AED 1,927");
    expect(ppf.values[1]).toBeNull();
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
