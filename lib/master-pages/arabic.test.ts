/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { applyArabic, withArabicDefaults, type ArabicStore } from "./arabic";
import { mergeValues } from "./index";
import { applyLocale } from "./i18n";
import { MASTER_PAGES } from "./pages";
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
  home: {
    hero: {
      title: { en: "Find a home worth keeping.", ar: "مسكن يستحق البقاء فيه.", by: "machine" },
      cta_label: { en: "Browse", ar: "تصفح", by: "machine" },
    },
  },
};

describe("applyArabic", () => {
  it("puts the Arabic where mergeValues and applyLocale will find it", () => {
    // The assertion the whole design rests on: an `_ar` key in a section's
    // DEFAULTS renders, with no migration and no database write.
    const merged = mergeValues(applyArabic(section, store.home!.hero), null);
    expect(merged.title_ar).toBe("مسكن يستحق البقاء فيه.");
    expect(applyLocale(merged, "ar", "hero.").values.title).toBe(
      "مسكن يستحق البقاء فيه.",
    );
  });

  it("leaves the English untouched", () => {
    const out = applyArabic(section, store.home!.hero);
    expect(out.defaults.title).toBe("Find a home worth keeping.");
    expect(applyLocale(mergeValues(out, null), "en", "hero.").values.title).toBe(
      "Find a home worth keeping.",
    );
  });

  it("drops Arabic whose English has since been edited", () => {
    // The staleness rule, and the direction it fails in. An editor rewrites the
    // headline; the Arabic underneath it now describes something else. Falling
    // back to English renders a complete page in the wrong language, which is
    // recoverable. Rendering the stale Arabic makes a claim the English does
    // not, which is not.
    const edited: SectionDef = {
      ...section,
      defaults: { ...section.defaults, title: "Find a home worth loving." },
    };
    const merged = mergeValues(applyArabic(edited, store.home!.hero), null);
    expect(merged.title_ar).toBeNull();
    expect(applyLocale(merged, "ar", "hero.").values.title).toBe(
      "Find a home worth loving.",
    );
  });

  it("returns the section by identity when there is nothing to apply", () => {
    expect(applyArabic(section, undefined)).toBe(section);
    expect(applyArabic(section, {})).toBe(section);
  });

  it("never lets a default beat what an editor saved", () => {
    // The client's own edit is permanent. A stored value wins over a default,
    // so once someone types Arabic in the CMS this file stops applying to that
    // field — which is the whole reason it is safe to generate into defaults.
    const merged = mergeValues(applyArabic(section, store.home!.hero), {
      title_ar: "عنوان كتبه المحرر",
    });
    expect(merged.title_ar).toBe("عنوان كتبه المحرر");
  });
});

describe("withArabicDefaults", () => {
  it("touches only the pages and sections named in the store", () => {
    const pages = withArabicDefaults(MASTER_PAGES, { nope: {} } as ArabicStore);
    expect(pages).toEqual(MASTER_PAGES);
  });

  it("is what the exported registry already ran through", () => {
    // Guards the wiring itself: MASTER_PAGES is the wrapped registry, so a
    // future refactor that exports the raw array would fail here rather than
    // silently rendering English forever.
    expect(withArabicDefaults(MASTER_PAGES)).toEqual(MASTER_PAGES);
  });
});
