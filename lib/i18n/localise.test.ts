import { describe, expect, it } from "vitest";
import { ARABIC_STORE } from "./arabic-store";
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
    // Deliberately not a phrase the site says. A blank twin falls back to
    // ARABIC_STORE, so a real label here — this was "Resale" — passes only
    // until someone translates that word, and then fails a test about holes
    // for a reason that has nothing to do with holes.
    heading: "Nothing in the store says this",
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
    // …and say so out loud, so the next translation run that reaches this
    // string fails on the premise rather than on the assertion.
    expect(
      ARABIC_STORE[row.heading],
      `The fixture's English must stay untranslated for this to test the ` +
        `fallback. Change the fixture string, not the store.`,
    ).toBeUndefined();
    expect(localiseRow(row, "ar").heading).toBe(row.heading);
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
    expect(localiseRow({ orphan_ar: "x", keep: "y" }, "ar")).toEqual({
      keep: "y",
    });
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
    featured: [
      {
        headline: "Solaya",
        headline_ar: "سلایا",
        cta_label: "See more",
        cta_label_ar: null,
      },
    ],
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
    /*
     * The second item has no typed Arabic; the first still gets its own. The
     * point is that the fallback is per FIELD — one blank twin does not drag
     * its siblings back to English.
     *
     * The values here are deliberately ones the shared store has never seen,
     * because a blank twin no longer means English: it means "ask the store".
     * "Villas" used to sit in this assertion and now resolves to الفلل, which
     * is the improvement, not a regression — see the store test below.
     */
    const out = localiseDeep(
      {
        ...tab,
        columns: [
          {
            ...tab.columns[0]!,
            items: [
              tab.columns[0]!.items[0]!,
              { label: "Kensington duplex wing", label_ar: null },
            ],
          },
        ],
      },
      "ar",
    );
    expect(out.columns[0]!.items[0]!.label).toBe("شقق");
    expect(out.columns[0]!.items[1]!.label).toBe("Kensington duplex wing");
  });

  it("resolves a blank twin through the shared store", () => {
    /*
     * The gap this closed. `fillArabic` has always given master-page sections
     * this fallback, and the flat columns never had it — so section documents
     * rendered ~88% Arabic and flat columns ~10%, from the same store, for the
     * same content. "Villas" has an entry; nobody typed it into this row.
     */
    const out = localiseDeep(tab, "ar");
    expect(out.columns[0]!.items[1]!.label).toBe("فلل");
  });

  it("only asks the store for columns that declare a twin", () => {
    /*
     * `localiseRow` sees EVERY column — id, slug, status, storage_key, prices.
     * A bare `arabicFor(value)` would swap any of them on a coincidental hit,
     * so the lookup is gated on the twin column being present on the row.
     * `status: "Villas"` is nonsense on purpose: it is exactly the shape that
     * would break if the guard were on the value instead of the key.
     */
    const row = { id: "abc", status: "Villas", label: "Villas", label_ar: null };
    const out = localiseDeep(row, "ar");
    expect(out.status).toBe("Villas");
    expect(out.label).toBe("فلل");
  });

  it("strips _ar at every depth", () => {
    const json = JSON.stringify(localiseDeep(tab, "ar"));
    expect(json).not.toContain("_ar");
  });

  it("passes plain values inside arrays through", () => {
    expect(
      localiseDeep({ amenities: ["Pool", "Gym"] }, "ar").amenities,
    ).toEqual(["Pool", "Gym"]);
  });

  it("does not dismantle a Date", () => {
    const when = new Date("2026-08-13T00:00:00Z");
    expect(localiseDeep({ when }, "ar").when).toBeInstanceOf(Date);
  });

  it("is a strip-only no-op in English", () => {
    expect(JSON.stringify(localiseDeep(tab, "en"))).not.toContain("_ar");
    expect(localiseDeep(tab, "en").columns[0].items[0].label).toBe(
      "Apartments",
    );
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
