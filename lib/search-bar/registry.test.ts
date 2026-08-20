import { describe, expect, it } from "vitest";

import { arabicFor } from "@/lib/i18n/arabic-store";
import { SEARCH_BAR_COPY_KEYS } from "./copy-keys";
import { SEARCH_BAR_DEF, defaultSearchBar } from "./registry";

/**
 * The registry is the promise that turning the CMS on changed nothing.
 *
 * `lib/forms/registry.test.ts` holds the lead forms to their literal strings
 * for the same reason: the defaults are not a starting point someone is
 * expected to improve, they are what the page rendered the day before the
 * editor existed. A "tidy-up" of a label here is a live copy change on the
 * home page, and it should have to argue with a failing test first.
 */
describe("the search-bar registry is what shipped", () => {
  const tabs = SEARCH_BAR_DEF.tabs;

  it("is ordered Off-Plan, Buy, Rent, Commercial", () => {
    expect(tabs.map((t) => t.key)).toEqual([
      "off-plan",
      "buy",
      "rent",
      "commercial",
    ]);
    expect(tabs.map((t) => t.label)).toEqual([
      "Off-Plan",
      "Buy",
      "Rent",
      "Commercial",
    ]);
  });

  it("keeps each tab pointed at its own route", () => {
    expect(tabs.map((t) => t.route)).toEqual([
      "/off-plan",
      "/buy",
      "/rent",
      "/commercial",
    ]);
  });

  it("asks residential tabs for an area, building, community or emirate", () => {
    for (const key of ["off-plan", "buy", "rent"]) {
      const tab = tabs.find((t) => t.key === key)!;
      expect(tab.placeholder).toBe("Area, building, community or emirate");
      expect(tab.beds).toBe(true);
      expect(tab.size).toBeNull();
      expect(tab.types.map((t) => t.value)).toEqual([
        "apartment",
        "townhouse",
        "villa",
        "penthouse",
      ]);
    }
  });

  it("gives commercial the granular type list, a size slider and no beds", () => {
    const commercial = tabs.find((t) => t.key === "commercial")!;
    expect(commercial.placeholder).toBe("Area or emirate");
    expect(commercial.beds).toBe(false);
    expect(commercial.size).toEqual({ max: 200_000, step: 1_000 });
    expect(commercial.types).toEqual([
      { value: "land", label: "Land", label_ar: null },
      { value: "office", label: "Office", label_ar: null },
      { value: "building", label: "Building", label_ar: null },
      { value: "retail", label: "Retail Space", label_ar: null },
      {
        value: "commercial_villa",
        label: "Commercial Villa",
        label_ar: null,
      },
    ]);
  });

  it("keeps the price ceilings the spec asked for", () => {
    expect(tabs.map((t) => t.price.max)).toEqual([
      50_000_000, 50_000_000, 1_000_000, 200_000_000,
    ]);
  });

  it("hands every shared label to the message catalogue", () => {
    // Blank is the instruction "use the site's own wording", already
    // translated. A registry that filled these in would fork eight strings the
    // filter bar also renders.
    for (const { key } of SEARCH_BAR_COPY_KEYS) {
      expect(SEARCH_BAR_DEF.copy[key]).toBeNull();
      expect(SEARCH_BAR_DEF.copy[`${key}_ar`]).toBeNull();
    }
  });
});

/**
 * The bug that opened this section: /ar rendered an English search bar.
 *
 * The twins are present-and-null on purpose — `localiseRow` only reaches for
 * the store when the twin KEY exists — so this asserts both halves: the key is
 * there, and the store has something to put in it.
 */
describe("every registry string can reach Arabic", () => {
  const bar = defaultSearchBar();

  it("declares a null twin beside every translatable string", () => {
    for (const tab of bar.tabs) {
      expect(tab).toHaveProperty("label_ar");
      expect(tab).toHaveProperty("placeholder_ar");
      for (const type of tab.types) expect(type).toHaveProperty("label_ar");
    }
  });

  it("has an Arabic entry in the store for every one of them", () => {
    const missing: string[] = [];
    for (const tab of bar.tabs) {
      for (const english of [
        tab.label,
        tab.placeholder,
        ...tab.types.map((t) => t.label),
      ]) {
        if (!arabicFor(english)) missing.push(english);
      }
    }
    expect(missing).toEqual([]);
  });
});
