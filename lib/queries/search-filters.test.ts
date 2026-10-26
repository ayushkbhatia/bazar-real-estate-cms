import { describe, expect, it, vi } from "vitest";

const values: Record<string, unknown> = {};
vi.mock("@/lib/queries/content-sections", () => ({
  getLibrarySectionContent: async () => ({ section: { values } }),
}));
vi.mock("@/lib/queries/amenities-taxonomy", () => ({
  listAmenitiesTaxonomy: async () => [
    { code: "pool", label: "Private Swimming Pool", label_ar: "مسبح خاص" },
    { code: "gym", label: "Gym", label_ar: null },
    { code: "spa", label: "Spa", label_ar: "سبا" },
  ],
}));

const { getSearchFilterSettings } = await import("./search-filters");

describe("getSearchFilterSettings", () => {
  it("offers nothing until the admin switches amenities on", async () => {
    values.amenities = [
      { enabled: false, amenity: "Gym" },
      { enabled: false, amenity: "Spa" },
    ];
    expect((await getSearchFilterSettings("en")).amenities).toEqual([]);
  });

  it("offers only the switched-on picks, alphabetically, in the page's language", async () => {
    values.amenities = [
      { enabled: true, amenity: "Spa" },
      { enabled: false, amenity: "Gym" },
      { enabled: true, amenity: "Private Swimming Pool" },
      { enabled: true, amenity: "Retired amenity" },
    ];
    expect((await getSearchFilterSettings("ar")).amenities).toEqual([
      { value: "Spa", label: "سبا" },
      { value: "Private Swimming Pool", label: "مسبح خاص" },
    ]);
    // English: A–Z by the English name, whatever the editor's order.
    expect(
      (await getSearchFilterSettings("en")).amenities.map((a) => a.label),
    ).toEqual(["Private Swimming Pool", "Spa"]);
  });
});
