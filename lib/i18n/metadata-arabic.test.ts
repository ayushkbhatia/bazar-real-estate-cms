/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { localiseSearchAppearance } from "@/lib/schemas/seo";
import { MASTER_PAGE_SEO_DEFAULTS } from "@/lib/master-pages/seo-defaults";
import { arabicFor } from "./arabic-store";

/**
 * W-4. An Arabic page carrying an English `<title>` into a search result is
 * worse than an untranslated one, because it looks finished — the visitor
 * clicks expecting English and gets Arabic, or the reverse.
 *
 * Two layers had to learn about the store: the CMS `seo` bag, and the code
 * defaults every route falls back to when that bag is blank. Sixteen pages
 * carry a `meta_title` and a `meta_description`, and before this not one
 * carried either Arabic twin.
 */

const bag = (over: Record<string, string | null> = {}) => ({
  meta_title: "Buy a Property in Abu Dhabi",
  meta_description: null,
  meta_title_ar: null,
  meta_description_ar: null,
  ...over,
});

describe("search appearance folds to Arabic", () => {
  it("prefers a twin an editor wrote", () => {
    const out = localiseSearchAppearance(
      bag({ meta_title_ar: "عنوان كتبه المحرر" }) as never,
      "ar",
    );
    expect(out.meta_title).toBe("عنوان كتبه المحرر");
  });

  it("falls back to the generated store when the twin is blank", () => {
    const english = MASTER_PAGE_SEO_DEFAULTS.buy.title;
    const generated = arabicFor(english);
    expect(generated, "the /buy title should be in the store").toBeTruthy();
    expect(localiseSearchAppearance(bag({ meta_title: english }) as never, "ar").meta_title).toBe(
      generated,
    );
  });

  it("leaves English alone on /en", () => {
    const english = MASTER_PAGE_SEO_DEFAULTS.buy.title;
    expect(localiseSearchAppearance(bag({ meta_title: english }) as never, "en").meta_title).toBe(
      english,
    );
  });

  it("keeps the English where nothing has translated it", () => {
    const out = localiseSearchAppearance(
      bag({ meta_title: "A title nobody has ever translated" }) as never,
      "ar",
    );
    expect(out.meta_title).toBe("A title nobody has ever translated");
  });
});

describe("the code-side defaults", () => {
  it("has Arabic for most master pages", () => {
    const withArabic = Object.values(MASTER_PAGE_SEO_DEFAULTS).filter((d) =>
      arabicFor(d.title),
    );
    // Shrink-only in the other direction: this should go UP, never down.
    expect(withArabic.length).toBeGreaterThanOrEqual(12);
  });

  it("never mixes the two languages inside one snippet", async () => {
    /*
     * The invariant, asserted over EVERY page rather than over whichever ones
     * happen to be half-translated today.
     *
     * The first version of this test asserted the pairing could not arise —
     * something a person had to keep green by hand. The second asserted the
     * behaviour, but only on pages that were actually half-translated, and so
     * it began failing the moment the last two descriptions were translated:
     * `expect(half.length).toBeGreaterThan(0)` made finishing the work a test
     * failure. Both shapes tied the test to the state of the corpus.
     *
     * This shape does not. `masterPageMetadata` must serve a snippet wholly in
     * one language, and that is true whether zero pages or all of them are
     * half-translated — so completing a translation can never break it, and
     * regressing the rule always will.
     */
    const { masterPageMetadata } = await import("@/lib/queries/search-appearance");

    for (const [key, d] of Object.entries(MASTER_PAGE_SEO_DEFAULTS)) {
      const meta = await masterPageMetadata(key as never, "ar");
      const raw =
        typeof meta.title === "string"
          ? meta.title
          : (meta.title as { absolute?: string })?.absolute;
      const titleTranslated = (raw ?? d.title) !== d.title;
      const descriptionTranslated =
        (meta.description ?? d.description) !== d.description;
      expect(
        titleTranslated,
        `${key}: the title and the description disagree about which language ` +
          `this snippet is in`,
      ).toBe(descriptionTranslated);
    }
  });

  it("still serves a fully translated page in Arabic", async () => {
    const { masterPageMetadata } = await import("@/lib/queries/search-appearance");
    const whole = Object.entries(MASTER_PAGE_SEO_DEFAULTS).find(
      ([, d]) => arabicFor(d.title) && arabicFor(d.description),
    )!;
    const meta = await masterPageMetadata(whole[0] as never, "ar");
    expect(meta.description).toBe(arabicFor(whole[1].description));
  });
});
