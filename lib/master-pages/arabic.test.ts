/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { fillArabic, type ArabicStore } from "./arabic";
import { mergeValues } from "./index";
import { applyLocale } from "./i18n";
import type { SectionDef } from "./types";

const section: SectionDef = {
  key: "hero",
  label: "Hero",
  description: "",
  fields: [
    { key: "title", label: "Title", kind: "text", max: 120 },
    { key: "cta_label", label: "Button", kind: "text", max: 60, optional: true },
  ],
  defaults: { title: "Find a home worth keeping.", cta_label: "Browse" },
};

const store: ArabicStore = {
  "Find a home worth keeping.": { ar: "استثمر في منزل يستحق البقاء.", by: "machine" },
  Browse: { ar: "تصفح", by: "machine" },
  "Your Future Has an Address": { ar: "لمستقبلك عنوان", by: "machine" },
};

describe("fillArabic", () => {
  it("fills a blank twin from the store", () => {
    const out = fillArabic(section.fields, { ...section.defaults }, store);
    expect(out.title_ar).toBe("استثمر في منزل يستحق البقاء.");
  });

  it("leaves the English untouched", () => {
    const out = fillArabic(section.fields, { ...section.defaults }, store);
    expect(out.title).toBe("Find a home worth keeping.");
  });

  it("never overwrites Arabic that is already there", () => {
    // An editor's value, or a hand-declared registry twin. Both outrank this.
    const out = fillArabic(
      section.fields,
      { ...section.defaults, title_ar: "عنوان كتبه المحرر" },
      store,
    );
    expect(out.title_ar).toBe("عنوان كتبه المحرر");
  });

  it("returns the bag by identity when nothing matches", () => {
    const values = { title: "Something nobody has translated", cta_label: null };
    expect(fillArabic(section.fields, values, store)).toBe(values);
  });
});

describe("mergeValues + fillArabic — the case that made this content-addressed", () => {
  /**
   * The bug this design replaced.
   *
   * Keyed by field path and folded into `def.defaults`, the Arabic for the
   * DEFAULT headline was served beside the editor's REPLACEMENT headline —
   * because `mergeValues` takes the stored English and falls back to the
   * default `_ar`. 303 master-page slots had been edited in production.
   */
  it("uses the editor's English and its matching Arabic", () => {
    // `mergeValues` reads the real store, so this exercises the mechanism with
    // an injected one: the English arrives from STORAGE, not from the registry
    // default, and still finds its Arabic. Under the old path-keyed design this
    // field would have rendered the DEFAULT headline's Arabic instead.
    const merged = { ...section.defaults, title: "Your Future Has an Address" };
    const out = fillArabic(section.fields, merged, store);
    expect(out.title).toBe("Your Future Has an Address");
    expect(out.title_ar).toBe("لمستقبلك عنوان");
  });

  it("falls back to English when the editor writes something new", () => {
    // No entry for this English, so no Arabic. `/ar` renders the English,
    // which is the designed fallback and the safe direction — the alternative
    // is Arabic that describes a headline nobody can see.
    const merged = mergeValues(section, { title: "A headline nobody has translated" });
    expect(merged.title).toBe("A headline nobody has translated");
    expect(merged.title_ar).toBeNull();
    expect(applyLocale(merged, "ar", "hero.").values.title).toBe(
      "A headline nobody has translated",
    );
  });

  it("still works for a page nobody has edited", () => {
    const merged = mergeValues(section, null);
    expect(applyLocale(merged, "ar", "hero.").values.title).toBe(
      "استثمر في منزل يستحق البقاء.",
    );
  });
});
