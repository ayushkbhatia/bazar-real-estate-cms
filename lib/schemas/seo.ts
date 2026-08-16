import { z } from "zod";

/**
 * The search-appearance bag — what an editor writes to control how a page
 * looks in a Google result.
 *
 * It is one shape rather than a per-table schema because it is stored in five
 * different places under three different column names (`pages.seo`,
 * `landing_pages.seo`, `developments.seo`, `articles.seo`, `areas.seo_meta`),
 * and the *contents* have always been the same two strings. Giving them one
 * schema is what lets one editor component serve every page editor instead of
 * each screen re-deciding what a meta description is allowed to be.
 *
 * Arabic lives inside the bag rather than in an `_ar` sibling column, which is
 * how lib/i18n/domains.ts already describes these columns (`inBag: true`).
 */

/**
 * Hard caps, deliberately looser than the point at which Google truncates.
 *
 * Truncation is not an error — a long title that reads well for the first 60
 * characters is a normal thing to write, and the preview shows exactly where
 * the cut falls. The cap exists to stop someone pasting a paragraph into the
 * title, not to enforce the display limit.
 *
 * The description cap is 220 rather than the 180 the editors have used since
 * the pages screen shipped, because 180 was wrong: four marketing pages have
 * shipped descriptions longer than that since launch — /services/manage's is
 * 203 — so an editor opening one of the new Search appearance cards could not
 * have retyped the string already on the page. A cap that rejects what the
 * site publishes is a bug in the cap, not in the copy.
 * `seo-defaults.test.ts` is what caught it and what keeps it honest; the
 * longest live title, /insights at 69, is why the title cap is left alone.
 */
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 220;

/**
 * Where Google actually cuts, in characters.
 *
 * Google truncates on rendered *pixel* width, not characters — roughly 600px
 * for the title and 920px for the snippet — so any character count is an
 * approximation, and a title of capitals or wide glyphs cuts earlier than one
 * of narrow ones. These are the figures the SEO field has been using for years
 * and they are close enough to make the preview honest about the risk; they
 * are not close enough to be worth enforcing, which is why they drive the
 * preview and never the validator.
 */
export const SEO_TITLE_DISPLAY = 60;
export const SEO_DESCRIPTION_DISPLAY = 155;

/** Empty string is the "cleared" state every one of these inputs emits. */
function metaText(max: number) {
  return z
    .union([z.literal(""), z.string().trim().max(max)])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
}

export const searchAppearanceSchema = z.object({
  meta_title: metaText(SEO_TITLE_MAX),
  meta_description: metaText(SEO_DESCRIPTION_MAX),
  /* Arabic twins. Caps are 1.5x their English siblings, matching `arMax` —
   * Arabic sets wider than Latin at the same character count, and a translator
   * hitting the English cap on a faithful translation is a false failure. */
  meta_title_ar: metaText(Math.round(SEO_TITLE_MAX * 1.5)),
  meta_description_ar: metaText(Math.round(SEO_DESCRIPTION_MAX * 1.5)),
});

export type SearchAppearanceInput = z.infer<typeof searchAppearanceSchema>;

/** Every key null — what an unedited page has. */
export const EMPTY_SEARCH_APPEARANCE: SearchAppearance = {
  meta_title: null,
  meta_description: null,
  meta_title_ar: null,
  meta_description_ar: null,
};

/** The parsed, always-present shape readers work with. */
export type SearchAppearance = {
  meta_title: string | null;
  meta_description: string | null;
  meta_title_ar: string | null;
  meta_description_ar: string | null;
};

/**
 * Read a stored `seo` / `seo_meta` bag into the four fields.
 *
 * Tolerant on purpose: these columns are untyped jsonb written by five
 * different code paths over thirteen sprints, so a reader that threw on an
 * unexpected key would take a public page down over a stray field. Anything
 * that is not a non-empty string reads as null, and unknown keys are ignored.
 */
export function readSearchAppearance(raw: unknown): SearchAppearance {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ...EMPTY_SEARCH_APPEARANCE };
  const bag = raw as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = bag[k];
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  };
  return {
    meta_title: str("meta_title"),
    meta_description: str("meta_description"),
    meta_title_ar: str("meta_title_ar"),
    meta_description_ar: str("meta_description_ar"),
  };
}

/**
 * Fold a bag down to one locale, the way `localiseRow` folds a table row.
 *
 * Arabic falls back to English rather than to nothing: a page with an English
 * meta description and no translation should still describe itself in a
 * result, in the site-wide fallback rule.
 */
export function localiseSearchAppearance(
  seo: SearchAppearance,
  locale: string,
): { meta_title: string | null; meta_description: string | null } {
  const ar = locale === "ar";
  return {
    meta_title: (ar ? seo.meta_title_ar : null) ?? seo.meta_title,
    meta_description:
      (ar ? seo.meta_description_ar : null) ?? seo.meta_description,
  };
}

/**
 * Merge an edit over what is stored, keeping other keys in the bag intact.
 *
 * `developments.seo` and `articles.seo` are shared bags — other code has put
 * keys in them — so a save must not be a whole-object replace. Null is a real
 * value here (the editor cleared the field), which is why this cannot be a
 * spread of only the truthy keys.
 */
export function mergeSearchAppearance(
  stored: unknown,
  edit: SearchAppearanceInput,
): Record<string, unknown> {
  const base =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? { ...(stored as Record<string, unknown>) }
      : {};
  for (const key of [
    "meta_title",
    "meta_description",
    "meta_title_ar",
    "meta_description_ar",
  ] as const) {
    base[key] = edit[key] ?? null;
  }
  return base;
}
