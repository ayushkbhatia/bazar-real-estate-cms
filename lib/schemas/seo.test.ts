import { describe, expect, it } from "vitest";
import {
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  localiseSearchAppearance,
  mergeSearchAppearance,
  readSearchAppearance,
  searchAppearanceSchema,
} from "./seo";

describe("searchAppearanceSchema", () => {
  it("clears an emptied field to null rather than storing an empty string", () => {
    // The inputs emit "" when an editor deletes the text. Storing that would
    // make `?? fallback` miss, and the page would publish an empty <title>.
    const r = searchAppearanceSchema.safeParse({
      meta_title: "",
      meta_description: "   ",
    });
    expect(r.success && r.data.meta_title).toBeNull();
    expect(r.success && r.data.meta_description).toBeNull();
  });

  it("rejects copy past the cap and accepts it at the cap", () => {
    expect(
      searchAppearanceSchema.safeParse({ meta_title: "x".repeat(SEO_TITLE_MAX) })
        .success,
    ).toBe(true);
    expect(
      searchAppearanceSchema.safeParse({
        meta_title: "x".repeat(SEO_TITLE_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      searchAppearanceSchema.safeParse({
        meta_description: "x".repeat(SEO_DESCRIPTION_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("gives Arabic a wider cap than its English sibling", () => {
    // Arabic sets wider than Latin at the same character count; a translator
    // hitting the English limit on a faithful translation is a false failure.
    const r = searchAppearanceSchema.safeParse({
      meta_title_ar: "ء".repeat(SEO_TITLE_MAX + 20),
    });
    expect(r.success).toBe(true);
  });
});

describe("readSearchAppearance", () => {
  it("reads the four fields out of a stored bag", () => {
    expect(
      readSearchAppearance({
        meta_title: "Buy in Abu Dhabi",
        meta_description: "Ready and off-plan homes.",
        unrelated_key: "left alone",
      }),
    ).toEqual({
      meta_title: "Buy in Abu Dhabi",
      meta_description: "Ready and off-plan homes.",
      meta_title_ar: null,
      meta_description_ar: null,
    });
  });

  it("never throws on the shapes thirteen sprints of jsonb can hold", () => {
    // These columns are untyped and written by five code paths. A reader that
    // threw would take a public page down over a stray value.
    for (const raw of [null, undefined, "a string", 7, [], { meta_title: 4 }]) {
      expect(readSearchAppearance(raw).meta_title).toBeNull();
    }
  });

  it("treats whitespace-only as absent", () => {
    expect(readSearchAppearance({ meta_title: "   " }).meta_title).toBeNull();
  });
});

describe("localiseSearchAppearance", () => {
  const bag = {
    meta_title: "Buy in Abu Dhabi",
    meta_description: "Ready and off-plan homes.",
    meta_title_ar: "اشترِ في أبوظبي",
    meta_description_ar: null,
  };

  it("serves English from the English keys", () => {
    expect(localiseSearchAppearance(bag, "en")).toEqual({
      meta_title: "Buy in Abu Dhabi",
      meta_description: "Ready and off-plan homes.",
    });
  });

  it("falls an untranslated Arabic field back to English, not to nothing", () => {
    expect(localiseSearchAppearance(bag, "ar")).toEqual({
      meta_title: "اشترِ في أبوظبي",
      meta_description: "Ready and off-plan homes.",
    });
  });
});

describe("mergeSearchAppearance", () => {
  it("keeps keys the SEO card does not own", () => {
    // `developments.seo` and `articles.seo` are shared bags; a whole-object
    // replace would silently drop whatever else lives in them.
    const merged = mergeSearchAppearance(
      { og_image: "/brand/card.png", meta_title: "old" },
      { meta_title: "new", meta_description: null },
    );
    expect(merged.og_image).toBe("/brand/card.png");
    expect(merged.meta_title).toBe("new");
  });

  it("writes an explicit null when a field is cleared", () => {
    // Clearing has to survive the merge — a spread of only truthy keys would
    // leave the old title in place and the editor's delete would do nothing.
    const merged = mergeSearchAppearance(
      { meta_title: "old", meta_description: "old" },
      { meta_title: null, meta_description: null },
    );
    expect(merged.meta_title).toBeNull();
    expect(merged.meta_description).toBeNull();
  });

  it("survives a stored value that is not an object", () => {
    expect(mergeSearchAppearance("nonsense", { meta_title: "t" })).toEqual({
      meta_title: "t",
      meta_description: null,
      meta_title_ar: null,
      meta_description_ar: null,
    });
  });
});
