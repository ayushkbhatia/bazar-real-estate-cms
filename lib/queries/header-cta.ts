/**
 * Reads for the header call-to-action registry
 * (`lib/master-pages/header-cta.ts`).
 *
 * Same contract as `lib/queries/developer-page.ts`: the cookie-free public
 * client, never throws, and never returns nothing — a document that fails to
 * load renders the button the site shipped with rather than leaving a hole in
 * the header of every page.
 *
 * `cache()` on the folded read because the public layout renders once per
 * request but the editor and the layout can both land in the same render pass.
 */
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { type Locale } from "@/lib/i18n/locales";
import {
  parseStoredSections,
  resolveSections,
  str,
  type ResolvedSection,
} from "@/lib/master-pages";
import {
  HEADER_CTA_FALLBACK_HREF,
  HEADER_CTA_PAGE_SLUG,
  HEADER_CTA_SECTION,
  headerCtaDef,
} from "@/lib/master-pages/header-cta";

export type HeaderCtaContent = {
  /** The one section this document holds, resolved over the code defaults. */
  section: ResolvedSection;
  /** True when nobody has saved it yet — the defaults are what renders. */
  usingDefaults: boolean;
};

/**
 * The document.
 *
 * @param locale Pass "bilingual" from the CMS editor. Omitted, it resolves
 * from the request — the fold `applyLocale` performs strips every `_ar` key,
 * so an editor handed folded values would render its Arabic inputs blank and
 * write that blank back on the next save.
 */
export async function getHeaderCtaContent(
  locale?: Locale | "bilingual",
): Promise<HeaderCtaContent> {
  const def = headerCtaDef();
  const fold = locale ?? (await currentLocale());

  const fallback = (): HeaderCtaContent => ({
    section: resolveSections(def, null, fold)[0]!,
    usingDefaults: true,
  });

  if (!isSupabaseConfigured) return fallback();

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("blocks")
      .eq("slug", HEADER_CTA_PAGE_SLUG)
      .maybeSingle();
    if (error || !data) return fallback();

    const stored = parseStoredSections(data.blocks);
    // No media fields on this section, so `attachImageUrls` has nothing to
    // resolve — deliberately not called.
    return {
      section: resolveSections(def, stored, fold)[0]!,
      usingDefaults: stored === null,
    };
  } catch (error) {
    console.error("[header-cta] failed to load the button document", error);
    return fallback();
  }
}

/**
 * The three values the nav renders.
 *
 * None of them is nullable. An editor who clears the label gets the shipped
 * wording back rather than an empty pill: a button with no text is not a
 * legible editorial choice the way a blank optional crumb is, it is a 44px
 * blank rectangle in the header of every page on the site. Switching the
 * button off is not what this screen is for — the section is `locked`.
 */
export type HeaderCta = {
  /** Desktop pill, and the button at the foot of the mobile drawer. */
  label: string;
  /** The compact button beside the hamburger below `xl`. */
  shortLabel: string;
  href: string;
};

export const getHeaderCta = cache(
  async (locale?: Locale): Promise<HeaderCta> => {
    const fold = locale ?? (await currentLocale());
    const content = await getHeaderCtaContent(fold);
    const values = content.section.values;
    /*
     * The shipped values resolved through the SAME fold. Reading
     * `HEADER_CTA_SECTION.defaults` directly would put the English label on
     * /ar the one time an editor blanks the field — the exact hole this
     * fallback exists to close.
     */
    const shipped = () => resolveSections(headerCtaDef(), null, fold)[0]!.values;

    const withFallback = (key: string): string =>
      str(values, key) ??
      str(shipped(), key) ??
      String(HEADER_CTA_SECTION.defaults[key] ?? "");

    return {
      label: withFallback("label"),
      shortLabel: withFallback("short_label"),
      // Not folded — `link` fields carry no twin, so one value serves both
      // languages and `@/components/i18n/link` prefixes the locale itself.
      href: str(values, "href") ?? HEADER_CTA_FALLBACK_HREF,
    };
  },
);
