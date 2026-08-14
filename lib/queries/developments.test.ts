import { describe, it, expect } from "vitest";
import {
  classifyUnit,
  countUnitsByFilter,
  developmentUrl,
  filterUnits,
  type DevelopmentUnit,
} from "./development-utils";
import { DETAIL_FIELDS } from "./developments";

function makeUnit(over: Partial<DevelopmentUnit>): DevelopmentUnit {
  const base = {
    id: over.id ?? "id",
    unit_type: "Villa A",
    beds: 3,
    built_up_ft2: 3800,
    plot_ft2: 5200,
    lagoon_access: "Direct" as string | null,
    orientation: "NW",
    price_aed: 6_200_000,
    plot_number: "A-12",
    status: "available" as const,
    floor_plan_id: null,
    ...over,
  };
  // Classified the same way the read path does it — from the row, once. A test
  // that hand-wrote `categories` could not catch the fold-order bug below.
  return { ...base, categories: over.categories ?? classifyUnit(base) };
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

  /**
   * The reason `classifyUnit` exists separately from `filterUnits`.
   *
   * On /ar the row arrives with `unit_type` already replaced by its Arabic
   * twin, and none of `/villa/i`, `/town|terrace/i` or `/walking/i` matches
   * Arabic. Classify first, fold second, and the chips keep working; do it the
   * other way round and every chip reads zero above a full table — which looks
   * like an empty project rather than a bug.
   */
  it("still filters a row whose text has been folded to Arabic", () => {
    const english = { unit_type: "Villa A", lagoon_access: "Direct" };
    const folded = makeUnit({
      id: "ar",
      unit_type: "فيلا أ",
      lagoon_access: "مباشر",
      categories: classifyUnit(english),
    });
    expect(filterUnits([folded], "villas")).toHaveLength(1);
    expect(filterUnits([folded], "lagoon")).toHaveLength(1);
    expect(filterUnits([folded], "townhouses")).toHaveLength(0);
  });

  it("classifies from English, and Arabic alone matches nothing", () => {
    // Not a wish — a statement of the constraint the fold order exists for.
    expect(classifyUnit({ unit_type: "فيلا أ", lagoon_access: null })).toEqual(
      [],
    );
    expect(
      classifyUnit({ unit_type: "Villa A", lagoon_access: "Walking · 2 min" }),
    ).toEqual(["villas"]);
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
