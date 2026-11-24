import { describe, expect, it } from "vitest";
import { getMasterPage, resolveSections, validateSections } from "../index";
import { EXPERTISE_AREA_SLUGS } from "./expertise";

// The documents production holds today, in their saved order — neither has
// the section, so this is where it lands until an editor saves the page.
const STORED = {
  home: ["hero", "location_browsing", "area_map", "off_plan_projects", "featured_properties"],
  areas: ["hero", "area_cards", "area_map", "area_spotlights"],
} as const;

describe("Our Expertise", () => {
  for (const [key, after] of [["home", "location_browsing"], ["areas", "area_cards"]] as const) {
    describe(`on ${key}`, () => {
      const def = getMasterPage(key)!;

      it(`lands right after ${after} in a document saved before it existed`, () => {
        const stored = STORED[key].map((k) => ({ key: k, enabled: true, values: {} }));
        const order = resolveSections(def, stored).map((s) => s.key);
        expect(order[order.indexOf(after) + 1]).toBe("expertise_areas");
      });

      it("ships on, titled Our Expertise, with the client's seven areas in order", () => {
        const section = resolveSections(def, null).find((s) => s.key === "expertise_areas")!;
        expect(section.enabled).toBe(true);
        expect(section.values.heading).toBe("Our Expertise");
        const cards = section.values.cards as Record<string, unknown>[];
        expect(cards.map((c) => c.slug)).toEqual([...EXPERTISE_AREA_SLUGS]);
        expect(cards.every((c) => c.enabled === true)).toBe(true);
      });

      it("reads Arabic on /ar before anyone edits it", () => {
        const section = resolveSections(def, null, "ar").find((s) => s.key === "expertise_areas")!;
        expect(section.values.heading).toBe("خبرتنا");
        expect(section.values.eyebrow).toBe("مجتمعات أبوظبي");
        // The slug is a lookup key; folding it would lose the area.
        const cards = section.values.cards as Record<string, unknown>[];
        expect(cards[0]!.slug).toBe("nareel-island");
      });

      it("saves its own defaults", () => {
        const section = resolveSections(def, null, "bilingual").find((s) => s.key === "expertise_areas")!;
        const result = validateSections(def, [{ key: "expertise_areas", enabled: true, values: section.values }]);
        expect(result.ok).toBe(true);
      });
    });
  }

  it("links to all locations from the home page, and to nothing from /areas itself", () => {
    const cta = (key: "home" | "areas") =>
      resolveSections(getMasterPage(key)!, null).find((s) => s.key === "expertise_areas")!.values.cta_href;
    expect(cta("home")).toBe("/areas");
    expect(cta("areas")).toBeNull();
  });
});
