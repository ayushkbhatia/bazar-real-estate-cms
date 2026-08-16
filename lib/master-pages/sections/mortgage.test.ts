import { describe, expect, it } from "vitest";
import { getMasterPage, resolveSections, str } from "../index";
import type { MasterPageDef } from "../types";
import { arabicTwins } from "../twins";

/**
 * /tools/mortgage is the first master page whose English was NOT hardcoded in
 * the component — it came out of the `tools` message catalogue, already
 * translated. So the invariant that matters here is not "the defaults match
 * the page" (../master-pages.test.ts covers the generic ones) but "the Arabic
 * survived the move": the fold must hand /ar Arabic, not the English default.
 */
const page = getMasterPage("mortgage") as MasterPageDef;

describe("mortgage master page", () => {
  it("registers at /tools/mortgage with a locked masthead", () => {
    expect(page).not.toBeNull();
    expect(page.path).toBe("/tools/mortgage");
    expect(page.sections.map((s) => s.key)).toEqual(["hero", "pre_approval"]);
    expect(page.sections.find((s) => s.key === "hero")?.locked).toBe(true);
  });

  it("carries an Arabic default for every translatable field", () => {
    // The whole reason this module hand-writes `_ar` defaults. A field that
    // gains one later is fine; a field that never had one is a hole on the
    // Arabic page that nobody sees until a customer does.
    const holes: string[] = [];
    for (const section of page.sections) {
      for (const twin of arabicTwins(section.fields)) {
        const value = section.defaults[twin.key];
        if (typeof value !== "string" || value.trim() === "") {
          holes.push(`${section.key}.${twin.key}`);
        }
      }
    }
    expect(holes, `no Arabic default for:\n${holes.join("\n")}`).toEqual([]);
  });

  it("folds to Arabic rather than to the English default", () => {
    const [hero, band] = resolveSections(page, null, "ar");
    expect(str(hero.values, "title")).toBe("ما الذي سيكلفك هذا العقار");
    expect(str(band.values, "eyebrow")).toBe("حان وقت التنفيذ؟");
    // The fold must never leak the storage shape to a renderer.
    expect(Object.keys(hero.values).some((k) => k.endsWith("_ar"))).toBe(false);
  });

  it("keeps the English exactly as the page rendered it", () => {
    const [hero, band] = resolveSections(page, null);
    expect(str(hero.values, "title")).toBe("What will this property actually");
    expect(str(hero.values, "title_emphasis")).toBe("cost you?");
    expect(str(band.values, "title")).toBe(
      "Get pre-approved with our preferred lenders.",
    );
    expect(str(band.values, "advisor_cta_href")).toBe("/contact");
  });

  it("lets the band be switched off without touching the masthead", () => {
    // The two switches the page draws are independent: this one removes the
    // band, and the form's own toggle in /admin/forms only removes the form.
    const resolved = resolveSections(page, [
      { key: "pre_approval", enabled: false, values: {} },
    ]);
    expect(resolved.find((s) => s.key === "pre_approval")?.enabled).toBe(false);
    expect(resolved.find((s) => s.key === "hero")?.enabled).toBe(true);
  });
});
