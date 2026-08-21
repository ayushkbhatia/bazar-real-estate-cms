import { describe, expect, it } from "vitest";
import {
  DEVELOPER_PAGE_SECTION,
  NAME_TOKEN,
  developerPageCopyDef,
  fillTokens,
} from "./developer-page";
import { resolveSections, str } from "./index";
import { arabicTwins } from "./twins";

/**
 * The developer profile pages' shared copy.
 *
 * The bug this registry closes was not "a missing translation" — it was an
 * Arabic page rendering `ALDAR Properties's projects.` under an Arabic
 * eyebrow, because the heading was built by concatenating a name onto an
 * English literal in the JSX. These assertions pin the two things that would
 * bring it back: an English default reaching `/ar`, and a heading assembled by
 * position rather than by token.
 */

const AR_DEFAULTS = Object.keys(DEVELOPER_PAGE_SECTION.defaults).filter((k) =>
  k.endsWith("_ar"),
);

describe("developer page copy", () => {
  it("ships Arabic beside every translatable English default", () => {
    const twins = arabicTwins(DEVELOPER_PAGE_SECTION.fields).map((f) => f.key);
    expect(twins.length).toBeGreaterThan(0);
    for (const key of twins) {
      expect(
        DEVELOPER_PAGE_SECTION.defaults[key],
        `${key} has no shipped Arabic`,
      ).toBeTruthy();
    }
    // Nothing declared as Arabic that no field asks for — a stray `_ar` key is
    // storage `mergeValues` would drop on the first save.
    expect(AR_DEFAULTS.sort()).toEqual(twins.sort());
  });

  it("never repeats the English as the Arabic", () => {
    for (const arKey of AR_DEFAULTS) {
      const en = DEVELOPER_PAGE_SECTION.defaults[arKey.slice(0, -3)];
      expect(DEVELOPER_PAGE_SECTION.defaults[arKey]).not.toBe(en);
    }
  });

  it("keeps the name token in both languages of every name-bearing field", () => {
    for (const key of ["projects_heading", "projects_empty"]) {
      expect(String(DEVELOPER_PAGE_SECTION.defaults[key])).toContain(
        NAME_TOKEN,
      );
      expect(String(DEVELOPER_PAGE_SECTION.defaults[`${key}_ar`])).toContain(
        NAME_TOKEN,
      );
    }
  });

  it("puts the token where each language wants it, not where English does", () => {
    const en = String(DEVELOPER_PAGE_SECTION.defaults.projects_heading);
    const ar = String(DEVELOPER_PAGE_SECTION.defaults.projects_heading_ar);
    // English trails the name with a possessive; Arabic leads with the noun.
    // A single "name + suffix" concatenation cannot produce both, which is
    // the entire reason `fillTokens` exists.
    expect(en.indexOf(NAME_TOKEN)).toBe(0);
    expect(ar.indexOf(NAME_TOKEN)).toBeGreaterThan(0);
  });

  it("folds to Arabic with no English left behind", () => {
    const [section] = resolveSections(developerPageCopyDef(), null, "ar");
    for (const key of AR_DEFAULTS.map((k) => k.slice(0, -3))) {
      expect(str(section.values, key)).toBe(
        DEVELOPER_PAGE_SECTION.defaults[`${key}_ar`],
      );
    }
    // The fold strips the storage shape — a renderer can never read `_ar`.
    expect(Object.keys(section.values).some((k) => k.endsWith("_ar"))).toBe(
      false,
    );
  });

  it("leaves the link fields untranslated", () => {
    const [section] = resolveSections(developerPageCopyDef(), null, "ar");
    expect(str(section.values, "projects_cta_href")).toBe("/off-plan");
  });
});

describe("fillTokens", () => {
  it("substitutes every occurrence", () => {
    expect(fillTokens("{name} and {name}", { name: "Aldar" })).toBe(
      "Aldar and Aldar",
    );
  });

  it("substitutes numbers", () => {
    expect(fillTokens("{shown} of {total}", { shown: 9, total: 41 })).toBe(
      "9 of 41",
    );
  });

  it("leaves an unknown token visible rather than blanking it", () => {
    // Visible is fixable. A silently deleted token reads as a copy mistake
    // nobody can trace back to the editor.
    expect(fillTokens("{nmae}'s projects.", { name: "Aldar" })).toBe(
      "{nmae}'s projects.",
    );
  });

  it("renders a sentence an editor stripped the token out of", () => {
    expect(fillTokens("Our projects.", { name: "Aldar" })).toBe(
      "Our projects.",
    );
  });
});
