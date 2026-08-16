import { describe, expect, it } from "vitest";
import { getMasterPage, resolveSections, str } from "../index";
import type { MasterPageDef, SectionValues } from "../types";
import { arabicTwins, baseKey } from "../twins";

/**
 * /tools/mortgage is the first master page whose English was NOT hardcoded in
 * the component — it came out of the `tools` message catalogue, already
 * translated. So the invariant that matters here is not "the defaults match
 * the page" (../master-pages.test.ts covers the generic ones) but "the Arabic
 * survived the move": the fold must hand /ar Arabic, not the English default.
 *
 * The second thing worth pinning is the split itself. The page is six sections
 * an editor arranges, and the arrangement is what the whole redesign buys — so
 * the keys, the order they ship in, and the fact that the outputs can be
 * switched off without taking the calculator with them are all asserted.
 */
const page = getMasterPage("mortgage") as MasterPageDef;
const values = (key: string): SectionValues =>
  resolveSections(page, null).find((s) => s.key === key)?.values ?? {};

describe("mortgage master page", () => {
  it("ships the sections in the order the redesign specifies", () => {
    expect(page.path).toBe("/tools/mortgage");
    expect(page.sections.map((s) => s.key)).toEqual([
      "hero",
      "scenario",
      "affordability",
      "compare",
      "amortization",
      "cash_to_close",
      "pre_approval",
    ]);
  });

  it("locks the two sections the page cannot be a page without", () => {
    // Everything else is an output an editor may reasonably not want. Losing
    // the hero leaves a calculator with no title; losing the scenario leaves
    // outputs with nothing to compute from.
    const locked = page.sections.filter((s) => s.locked).map((s) => s.key);
    expect(locked).toEqual(["hero", "scenario"]);
  });

  it("carries an Arabic default for every translatable field that has English", () => {
    // The whole reason this module hand-writes `_ar` defaults. A field whose
    // English default is blank has nothing to translate; one that has English
    // and no Arabic is a hole on the Arabic page that nobody sees until a
    // customer does.
    const holes: string[] = [];
    for (const section of page.sections) {
      for (const twin of arabicTwins(section.fields)) {
        const english = section.defaults[baseKey(twin.key)!];
        if (typeof english !== "string" || english.trim() === "") continue;
        const value = section.defaults[twin.key];
        if (typeof value !== "string" || value.trim() === "") {
          holes.push(`${section.key}.${twin.key}`);
        }
      }
    }
    expect(holes, `no Arabic default for:\n${holes.join("\n")}`).toEqual([]);
  });

  it("folds to Arabic rather than to the English default", () => {
    const [hero, scenario] = resolveSections(page, null, "ar");
    expect(str(hero.values, "title")).toBe("ما الذي سيكلفك هذا العقار");
    expect(str(scenario.values, "eyebrow")).toBe("السيناريو");
    // The fold must never leak the storage shape to a renderer.
    expect(Object.keys(hero.values).some((k) => k.endsWith("_ar"))).toBe(false);
  });

  it("keeps the copy the page carried before the split", () => {
    expect(str(values("hero"), "title")).toBe(
      "What will this property actually",
    );
    expect(str(values("hero"), "title_emphasis")).toBe("cost you?");
    expect(str(values("pre_approval"), "title")).toBe(
      "Get pre-approved with our preferred lenders.",
    );
    expect(str(values("pre_approval"), "advisor_cta_href")).toBe("/contact");
    // Section heads lifted out of the `tools` catalogue, string for string.
    expect(str(values("cash_to_close"), "title")).toBe("What you actually wire");
    expect(str(values("amortization"), "title")).toBe("How interest tapers");
    expect(str(values("compare"), "title")).toBe(
      "What if you change one variable?",
    );
  });

  it("opens with the form in the hero", () => {
    // The client asked for the hero to carry the image and the form, the way
    // /services/manage does. The closing band then becomes a button back up to
    // it — `pre-approval.tsx` reads this same flag, so the form is never drawn
    // twice.
    expect(values("hero").show_form).toBe(true);
    expect(str(values("pre_approval"), "jump_cta_label")).toBeTruthy();
  });

  it("templates the amortization eyebrow on the selected term", () => {
    expect(str(values("amortization"), "eyebrow")).toContain("{years}");
  });

  it("lets every output be switched off without touching the calculator", () => {
    const off = ["affordability", "compare", "amortization", "cash_to_close"];
    const resolved = resolveSections(
      page,
      off.map((key) => ({ key, enabled: false, values: {} })),
    );
    const enabled = new Map(resolved.map((s) => [s.key, s.enabled]));
    for (const key of off) expect(enabled.get(key), key).toBe(false);
    expect(enabled.get("hero")).toBe(true);
    expect(enabled.get("scenario")).toBe(true);
  });
});
