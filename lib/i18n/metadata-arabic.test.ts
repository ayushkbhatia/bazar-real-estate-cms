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

  it("serves a half-translated snippet in English, not in both", async () => {
    /*
     * The invariant that matters, asserted on BEHAVIOUR rather than on data.
     *
     * Three pages have an Arabic title and an English description, because
     * their descriptions were blocked by the round trip. An earlier version of
     * this test asserted that could not happen, which made it a test somebody
     * would have to keep green by hand. `masterPageMetadata` now refuses the
     * pairing outright: unless both halves have Arabic, the whole snippet
     * stays English.
     */
    const { masterPageMetadata } = await import("@/lib/queries/search-appearance");

    const half = Object.entries(MASTER_PAGE_SEO_DEFAULTS).filter(
      ([, d]) => Boolean(arabicFor(d.title)) !== Boolean(arabicFor(d.description)),
    );
    expect(half.length, "no half-translated page left to check").toBeGreaterThan(0);

    for (const [key, d] of half) {
      const meta = await masterPageMetadata(key as never, "ar");
      const title = typeof meta.title === "string" ? meta.title : (meta.title as { absolute?: string })?.absolute;
      expect(title ?? d.title, `${key} title`).toBe(d.title);
      expect(meta.description, `${key} description`).toBe(d.description);
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
