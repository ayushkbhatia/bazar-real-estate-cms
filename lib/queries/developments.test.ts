import { describe, it, expect } from "vitest";
import {
  countUnitsByFilter,
  developmentUrl,
  filterUnits,
  type DevelopmentUnit,
} from "./development-utils";
import { DETAIL_FIELDS } from "./developments";

function makeUnit(over: Partial<DevelopmentUnit>): DevelopmentUnit {
  return {
    id: over.id ?? "id",
    unit_type: "Villa A",
    beds: 3,
    built_up_ft2: 3800,
    plot_ft2: 5200,
    lagoon_access: "Direct",
    orientation: "NW",
    price_aed: 6_200_000,
    plot_number: "A-12",
    status: "available",
    floor_plan_id: null,
    ...over,
  };
}

const UNITS: DevelopmentUnit[] = [
  makeUnit({ id: "1", unit_type: "Villa A", lagoon_access: "Direct" }),
  makeUnit({ id: "2", unit_type: "Villa B", lagoon_access: "Direct" }),
  makeUnit({ id: "3", unit_type: "Villa F", lagoon_access: "Corner · double" }),
  makeUnit({
    id: "4",
    unit_type: "Townhouse",
    lagoon_access: "Walking · 2 min",
  }),
  makeUnit({
    id: "5",
    unit_type: "Terrace",
    lagoon_access: null,
  }),
  makeUnit({ id: "6", unit_type: "Villa E", lagoon_access: "Frontage" }),
];

describe("filterUnits", () => {
  it("returns all units for 'all'", () => {
    expect(filterUnits(UNITS, "all")).toHaveLength(UNITS.length);
  });

  it("matches 'Villa X' types for villas", () => {
    const v = filterUnits(UNITS, "villas");
    expect(v.map((u) => u.id).sort()).toEqual(["1", "2", "3", "6"]);
  });

  it("matches townhouse + terrace for townhouses", () => {
    const t = filterUnits(UNITS, "townhouses");
    expect(t.map((u) => u.id).sort()).toEqual(["4", "5"]);
  });

  it("excludes walking-distance lagoons from the lagoon filter", () => {
    const l = filterUnits(UNITS, "lagoon");
    // 1, 2, 3, 6 are direct/frontage/corner.  4 is walking — excluded.  5 is null.
    expect(l.map((u) => u.id).sort()).toEqual(["1", "2", "3", "6"]);
  });
});

describe("countUnitsByFilter", () => {
  it("returns the same counts as filterUnits", () => {
    const counts = countUnitsByFilter(UNITS);
    expect(counts).toEqual({
      all: 6,
      villas: 4,
      townhouses: 2,
      lagoon: 4,
    });
  });
  it("handles an empty list", () => {
    expect(countUnitsByFilter([])).toEqual({
      all: 0,
      villas: 0,
      townhouses: 0,
      lagoon: 0,
    });
  });
});

describe("developmentUrl", () => {
  it("builds /developments/<slug>", () => {
    expect(developmentUrl({ slug: "saadiyat-lagoons" })).toBe(
      "/developments/saadiyat-lagoons",
    );
  });
});

describe("development detail media joins", () => {
  /**
   * The site plan uploaded in the CMS never appeared on the public page: the
   * admin saves it to `developments.masterplan_id`, but the page looked for a
   * `development_media` row tagged `masterplan` — a row nothing writes, so the
   * lookup always came back empty and rendered placeholder art instead.
   *
   * Nothing errored, which is why it went unnoticed. This pins the join so the
   * two halves can't drift apart again silently.
   */
  it("joins both images from the columns the CMS writes", () => {
    expect(DETAIL_FIELDS).toContain(
      "hero:hero_image_id(storage_key, filename, alt_text)",
    );
    expect(DETAIL_FIELDS).toContain(
      "masterplan:masterplan_id(storage_key, filename, alt_text)",
    );
  });
});
