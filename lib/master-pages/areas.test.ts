import { describe, it, expect } from "vitest";
import {
  MASTER_PAGES,
  getMasterPage,
  isMasterPageKey,
  masterSlug,
  resolveSections,
  validateSections,
  faqPairs,
  statPairs,
  list,
  str,
  isListField,
  type MasterPageDef,
  type SectionDef,
} from ".";
import { chipLines, headlineParts } from "./text";

const areas = getMasterPage("areas") as MasterPageDef;
const section = (key: string) =>
  areas.sections.find((s) => s.key === key) as SectionDef;

describe("the areas master page is registered", () => {
  it("is in the registry with the public path", () => {
    expect(isMasterPageKey("areas")).toBe(true);
    expect(areas.path).toBe("/areas");
    expect(masterSlug("areas")).toBe("master/areas");
  });

  it("appears alongside the other master pages", () => {
    // /admin/pages lists MASTER_PAGES directly, so being in this array is what
    // puts the page in the admin.
    expect(MASTER_PAGES.map((p) => p.key)).toContain("areas");
  });

  it("declares the sections the page renders, in page order", () => {
    expect(areas.sections.map((s) => s.key)).toEqual([
      "hero",
      "area_cards",
      "all_areas",
      "area_map",
      "area_spotlights",
      "list_your_property",
      "community_types",
      "why_bazar",
      "faqs",
    ]);
  });

  it("locks the hero and leaves everything else movable", () => {
    expect(section("hero").locked).toBe(true);
    for (const s of areas.sections) {
      if (s.key !== "hero") expect(s.locked, s.key).toBeFalsy();
    }
  });
});

describe("defaults reproduce the page as it shipped", () => {
  const resolved = resolveSections(areas, null);
  const values = (key: string) =>
    resolved.find((s) => s.key === key)?.values ?? {};

  it("renders every section when nothing is stored", () => {
    expect(resolved.every((s) => s.enabled)).toBe(true);
  });

  it("keeps the hero copy", () => {
    const v = values("hero");
    expect(str(v, "eyebrow")).toBe("Abu Dhabi Locations");
    expect(str(v, "title")).toBe("Explore Abu Dhabi's leading communities.");
    expect(str(v, "subtitle")).toContain("waterfront destinations");
  });

  it("ships two spotlights pointing at seeded area guides", () => {
    const items = list<Record<string, unknown>>(
      values("area_spotlights"),
      "items",
    );
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.href)).toEqual([
      "/areas/hudayriyat-island",
      "/areas/al-reem-island",
    ]);
  });

  it("ships the four community types the design calls for", () => {
    const items = list<Record<string, unknown>>(
      values("community_types"),
      "items",
    );
    expect(items.map((i) => i.name)).toEqual([
      "Waterfront Communities",
      "Gated Communities",
      "Luxury Communities",
      "Family-Friendly Communities",
    ]);
    // Eight chips each, as on the page today.
    for (const t of items) {
      expect(chipLines(t.chips), String(t.name)).toHaveLength(8);
    }
  });

  it("keeps the six FAQ entries", () => {
    expect(faqPairs(values("faqs"))).toHaveLength(6);
  });

  it("keeps both Why Bazar stats", () => {
    expect(statPairs(values("why_bazar"))).toEqual([
      ["20+ yrs", "In the UAE market"],
      ["Every district", "Abu Dhabi coverage"],
    ]);
  });

  it("leaves the area cards empty so live areas drive the grid", () => {
    // An empty list means "whatever the page renders by default" — here the
    // marquee order from live data, not a blank section.
    expect(list(values("area_cards"), "cards")).toEqual([]);
  });
});

describe("every editable section can be edited", () => {
  it("gives each content section text fields", () => {
    // area_map is the one intentional exception — it has no copy of its own.
    for (const s of areas.sections) {
      if (s.key === "area_map") continue;
      expect(s.fields.length, s.key).toBeGreaterThan(0);
    }
  });

  it("offers an image on every section that renders one", () => {
    const withImages = ["area_cards", "area_spotlights", "list_your_property", "community_types"];
    for (const key of withImages) {
      const s = section(key);
      const hasImage = s.fields.some(
        (f) =>
          f.kind === "image" ||
          (isListField(f) && f.fields.some((sub) => sub.kind === "image")),
      );
      expect(hasImage, key).toBe(true);
    }
  });

  it("offers a link on every card list, so a tile can be repointed", () => {
    for (const key of ["area_cards", "area_spotlights", "community_types"]) {
      const listField = section(key).fields.find(isListField);
      expect(listField, key).toBeTruthy();
      expect(
        listField!.fields.some((f) => f.kind === "link"),
        key,
      ).toBe(true);
    }
  });

  it("lets each card be hidden without being deleted", () => {
    for (const key of ["area_cards", "area_spotlights", "community_types"]) {
      const listField = section(key).fields.find(isListField);
      expect(
        listField!.fields.some((f) => f.key === "enabled" && f.kind === "toggle"),
        key,
      ).toBe(true);
    }
  });

  it("seeds the area cards from live areas", () => {
    const listField = section("area_cards").fields.find(isListField);
    expect(listField?.seedKey).toBe("areas");
  });
});

describe("saving an areas document", () => {
  it("keeps a reordered, partly hidden arrangement", () => {
    const result = validateSections(areas, [
      { key: "community_types", enabled: true, values: {} },
      { key: "hero", enabled: true, values: {} },
      { key: "area_map", enabled: false, values: {} },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Sections the client didn't send keep their place at the end.
    expect(result.sections.slice(0, 3).map((s) => s.key)).toEqual([
      "community_types",
      "hero",
      "area_map",
    ]);
    expect(result.sections.find((s) => s.key === "area_map")?.enabled).toBe(
      false,
    );
    // The hero is locked, so it stays on however it was submitted.
    expect(result.sections.find((s) => s.key === "hero")?.enabled).toBe(true);
  });

  it("round-trips a reorder through resolveSections", () => {
    const stored = [
      { key: "faqs", enabled: true, values: {} },
      { key: "hero", enabled: true, values: {} },
    ];
    const order = resolveSections(areas, stored).map((s) => s.key);
    expect(order[0]).toBe("faqs");
    expect(order[1]).toBe("hero");
    // Everything else survives, appended.
    expect(order).toHaveLength(areas.sections.length);
  });

  it("rejects more community types than the section allows", () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => ({ name: `Type ${i}` }));
    const result = validateSections(areas, [
      { key: "community_types", enabled: true, values: { items: tooMany } },
    ]);
    expect(result.ok).toBe(false);
  });

  it("cannot switch the hero off", () => {
    const result = validateSections(areas, [
      { key: "hero", enabled: false, values: {} },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections.find((s) => s.key === "hero")?.enabled).toBe(true);
  });
});

describe("chipLines", () => {
  it("splits one label per line", () => {
    expect(chipLines("Yas Acres\nBloom Living")).toEqual([
      "Yas Acres",
      "Bloom Living",
    ]);
  });

  it("drops blanks and trims, so a pasted list doesn't render empty chips", () => {
    expect(chipLines("  Yas Acres  \n\n\n  Noya \n")).toEqual([
      "Yas Acres",
      "Noya",
    ]);
  });

  it("handles Windows line endings", () => {
    expect(chipLines("A\r\nB")).toEqual(["A", "B"]);
  });

  it("returns nothing for a non-string", () => {
    expect(chipLines(null)).toEqual([]);
    expect(chipLines(42)).toEqual([]);
  });
});

describe("headlineParts", () => {
  it("italicises the final word", () => {
    expect(headlineParts("Explore Abu Dhabi's leading communities.")).toEqual({
      lead: "Explore Abu Dhabi's leading",
      last: "communities.",
    });
  });

  it("emphasises the whole thing when there is one word", () => {
    expect(headlineParts("Communities")).toEqual({
      lead: "",
      last: "Communities",
    });
  });

  it("collapses stray whitespace rather than emitting an empty word", () => {
    expect(headlineParts("  Two   words  ")).toEqual({
      lead: "Two",
      last: "words",
    });
  });

  it("survives an empty headline", () => {
    expect(headlineParts("   ")).toEqual({ lead: "", last: "" });
  });
});
