/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  liveAmenities,
  liveChips,
  liveDining,
  liveSchools,
} from "./band-sources";
import type { SectionValues } from "@/lib/master-pages";

const SEED_SCHOOLS = [
  { name: "Cranleigh", curriculum: "British", distance_km: 1.2, rating: null },
];
const SEED_AMENITIES = ["Saadiyat Beach Club"];

describe("the seed is the fallback, not the loser", () => {
  /*
   * The bands ship switched off with an empty list, so "never edited" and
   * "edited to nothing" arrive here identically. Both have to show what the
   * area ships with — an editor who has not opened the band yet must not be
   * the reason a column is blank.
   */
  const blank: SectionValues[] = [{}, { schools: [], amenities: [] }];

  it.each(blank)("keeps the seed schools when nothing is stored", (v) => {
    expect(liveSchools(v, SEED_SCHOOLS)).toEqual(SEED_SCHOOLS);
  });

  it.each(blank)("keeps the seed amenities when nothing is stored", (v) => {
    expect(liveAmenities(v, SEED_AMENITIES)).toEqual(SEED_AMENITIES);
  });

  it("returns null for the dossier's lists so the seed shows through", () => {
    expect(liveChips({})).toBeNull();
    expect(liveDining({})).toBeNull();
  });
});

describe("a stored list replaces the seed entirely", () => {
  it("takes the editor's schools", () => {
    const out = liveSchools(
      {
        schools: [
          { name: "Repton", curriculum: "British", rating: "Outstanding", distance: "2.4" },
        ],
      },
      SEED_SCHOOLS,
    );
    expect(out).toEqual([
      { name: "Repton", curriculum: "British", rating: "Outstanding", distance_km: 2.4 },
    ]);
  });

  it("takes the editor's amenities", () => {
    expect(
      liveAmenities({ amenities: [{ name: "Marina" }] }, SEED_AMENITIES),
    ).toEqual(["Marina"]);
  });
});

describe("switching a row off hides it without deleting it", () => {
  it("drops a disabled school and a nameless one", () => {
    const out = liveSchools(
      {
        schools: [
          { name: "Repton", enabled: false },
          { name: "   " },
          { name: "Cranleigh" },
        ],
      },
      SEED_SCHOOLS,
    );
    expect(out.map((s) => s.name)).toEqual(["Cranleigh"]);
  });

  it("falls back to the seed when every row is switched off", () => {
    expect(
      liveAmenities({ amenities: [{ name: "Marina", enabled: false }] }, SEED_AMENITIES),
    ).toEqual(SEED_AMENITIES);
  });
});

describe("the numeric fields are text in the editor and numbers on the page", () => {
  it("reads a blank distance as absent rather than as zero", () => {
    const out = liveSchools({ schools: [{ name: "Repton", distance: "  " }] }, []);
    expect(out[0]!.distance_km).toBeNull();
  });

  it("reads a non-numeric distance as absent", () => {
    const out = liveSchools({ schools: [{ name: "Repton", distance: "close" }] }, []);
    expect(out[0]!.distance_km).toBeNull();
  });

  it("keeps a real distance", () => {
    const out = liveSchools({ schools: [{ name: "Repton", distance: "0.8" }] }, []);
    expect(out[0]!.distance_km).toBe(0.8);
  });

  it("blanks an empty curriculum and rating rather than rendering ' · '", () => {
    const out = liveSchools({ schools: [{ name: "Repton", curriculum: "  ", rating: "" }] }, []);
    expect(out[0]!.curriculum).toBeNull();
    expect(out[0]!.rating).toBeNull();
  });
});

describe("the commute chip's mode", () => {
  it("keeps the three the icon set knows", () => {
    const out = liveChips({
      chips: [
        { label: "Corniche", minutes: "14", mode: "car" },
        { label: "Yas", minutes: "20", mode: "metro" },
        { label: "Beach", minutes: "5", mode: "walk" },
      ],
    });
    expect(out!.map((c) => c.mode)).toEqual(["car", "metro", "walk"]);
  });

  it("falls back to car for anything else, so the icon never goes missing", () => {
    const out = liveChips({ chips: [{ label: "Corniche", minutes: "14", mode: "ferry" }] });
    expect(out![0]!.mode).toBe("car");
  });

  it("reads a blank minutes as zero rather than NaN", () => {
    const out = liveChips({ chips: [{ label: "Corniche", minutes: "" }] });
    expect(out![0]!.minutes).toBe(0);
  });
});

describe("dining picks", () => {
  it("takes the editor's rows and tolerates a missing note", () => {
    const out = liveDining({ dining: [{ name: "Niri", kind: "Japanese" }] });
    expect(out).toEqual([{ name: "Niri", kind: "Japanese", note: "" }]);
  });
});
