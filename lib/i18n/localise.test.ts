import { describe, expect, it } from "vitest";
import { localiseDeep, localiseRow, missingTranslations } from "./localise";

/**
 * The two invariants, held for flat rows exactly as `applyLocale` holds them
 * for section bags. A reader should not have to know which kind of surface
 * they are looking at.
 */
describe("localiseRow", () => {
  const row = {
    id: "1",
    label: "Buy",
    label_ar: "شراء",
    href: "/buy",
    heading: "Resale",
    heading_ar: null,
  };

  it("never leaks an _ar key to a renderer", () => {
    // Invariant 1: after the fold, the storage shape is gone, so a component
    // cannot accidentally read it.
    for (const locale of ["en", "ar"] as const) {
      expect(Object.keys(localiseRow(row, locale))).toEqual([
        "id",
        "label",
        "href",
        "heading",
      ]);
    }
  });

  it("applies Arabic when present", () => {
    expect(localiseRow(row, "ar").label).toBe("شراء");
  });

  it("leaves the English in place when Arabic is blank", () => {
    // Invariant 2: an untranslated row renders complete, never a hole.
    expect(localiseRow(row, "ar").heading).toBe("Resale");
  });

  it("treats whitespace as blank", () => {
    // An editor who typed a space then deleted it must not blank the page.
    expect(localiseRow({ a: "English", a_ar: "   " }, "ar").a).toBe("English");
  });

  it("changes nothing but the strip in English", () => {
    const { label_ar: _1, heading_ar: _2, ...english } = row;
    expect(localiseRow(row, "en")).toEqual(english);
  });

  it("defaults to English when no locale is given", () => {
    expect(localiseRow(row).label).toBe("Buy");
  });

  it("leaves a twin with no English sibling alone", () => {
    // `foo_ar` with no `foo` is a data mistake, not a translation. Inventing
    // `foo` here would put a key on the object that no renderer expects.
    expect(localiseRow({ orphan_ar: "x", keep: "y" }, "ar")).toEqual({ keep: "y" });
  });
});

describe("localiseDeep", () => {
  const tab = {
    slug: "buy",
    label: "Buy",
    label_ar: "شراء",
    columns: [
      {
        heading: "Resale",
        heading_ar: "إعادة بيع",
        items: [
          { label: "Apartments", label_ar: "شقق", href: "/buy?type=apartment" },
          { label: "Villas", label_ar: null, href: "/buy?type=villa" },
        ],
      },
    ],
    featured: [{ headline: "Solaya", headline_ar: "سلایا", cta_label: "See more", cta_label_ar: null }],
  };

  it("folds every level in one call", () => {
    // The point of recursing: a tab owns columns, a column owns items, a tab
    // owns tiles. One call at the top instead of one per level is what makes
    // "add a twin and it works" true.
    const out = localiseDeep(tab, "ar");
    expect(out.label).toBe("شراء");
    expect(out.columns[0].heading).toBe("إعادة بيع");
    expect(out.columns[0].items[0].label).toBe("شقق");
    expect(out.featured[0].headline).toBe("سلایا");
  });

  it("falls back per field, not per row", () => {
    // The second item has no Arabic; the first still gets its own.
    const out = localiseDeep(tab, "ar");
    expect(out.columns[0].items[1].label).toBe("Villas");
    expect(out.featured[0].cta_label).toBe("See more");
  });

  it("strips _ar at every depth", () => {
    const json = JSON.stringify(localiseDeep(tab, "ar"));
    expect(json).not.toContain("_ar");
  });

  it("passes plain values inside arrays through", () => {
    expect(localiseDeep({ amenities: ["Pool", "Gym"] }, "ar").amenities).toEqual([
      "Pool",
      "Gym",
    ]);
  });

  it("does not dismantle a Date", () => {
    const when = new Date("2026-08-13T00:00:00Z");
    expect(localiseDeep({ when }, "ar").when).toBeInstanceOf(Date);
  });

  it("is a strip-only no-op in English", () => {
    expect(JSON.stringify(localiseDeep(tab, "en"))).not.toContain("_ar");
    expect(localiseDeep(tab, "en").columns[0].items[0].label).toBe("Apartments");
  });
});

describe("missingTranslations", () => {
  it("reports fields with English but no Arabic", () => {
    expect(
      missingTranslations({ a: "x", a_ar: null, b: "y", b_ar: "ب" }, "ar"),
    ).toEqual(["a"]);
  });

  it("does not count a field that has no English either", () => {
    // Nothing to translate is not a missing translation, and counting it would
    // make coverage look worse than it is.
    expect(missingTranslations({ a: null, a_ar: null }, "ar")).toEqual([]);
  });

  it("reports nothing in English", () => {
    expect(missingTranslations({ a: "x", a_ar: null }, "en")).toEqual([]);
  });
});
