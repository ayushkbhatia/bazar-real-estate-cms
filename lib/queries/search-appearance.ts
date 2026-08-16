import type { Metadata } from "next";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { masterSlug, type MasterPageKey } from "@/lib/master-pages";
import { MASTER_PAGE_SEO_DEFAULTS } from "@/lib/master-pages/seo-defaults";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { getPublicBranding } from "@/lib/queries/site-settings";
import { arabicFor } from "@/lib/i18n/arabic-store";
import {
  EMPTY_SEARCH_APPEARANCE,
  localiseSearchAppearance,
  readSearchAppearance,
  type SearchAppearance,
} from "@/lib/schemas/seo";

/**
 * Reads go through the cookie-free public client, like every other master-page
 * read: `generateMetadata` runs during prerender, and a client that touches
 * `cookies()` would take the route out of the static build. Never throws — a
 * page whose SEO row cannot be read publishes its code fallback, which is what
 * it published before this existed.
 */
export async function getMasterPageSearchAppearance(
  key: MasterPageKey,
): Promise<SearchAppearance> {
  if (!isSupabaseConfigured) return { ...EMPTY_SEARCH_APPEARANCE };
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("pages")
      .select("seo")
      .eq("slug", masterSlug(key))
      .maybeSingle();
    if (error || !data) return { ...EMPTY_SEARCH_APPEARANCE };
    return readSearchAppearance(data.seo);
  } catch (error) {
    console.error(`[search-appearance] failed to load "${key}"`, error);
    return { ...EMPTY_SEARCH_APPEARANCE };
  }
}

/**
 * A master page's `Metadata`, with the CMS on top of what the route declares.
 *
 * Every one of the seventeen marketing routes used to hold a literal
 * `export const metadata`, which made the two strings a visitor is most likely
 * to read the only copy on the page that required a deploy to change. Those
 * literals were not deleted — they moved to `MASTER_PAGE_SEO_DEFAULTS` and are
 * still what the page publishes when nobody has edited it, so an unreachable
 * database changes nothing about what ships.
 *
 * The CMS title is set as `absolute`, so what an editor types is exactly what
 * ships. The root layout's `%s · Bazar` template would otherwise append eight
 * characters that the editor never sees and that push a carefully-measured
 * title past Google's cut — the preview in the CMS shows the string as typed,
 * and the published title has to match it or the preview is a lie. A page that
 * wants the suffix can type it.
 */
export async function masterPageMetadata(
  key: MasterPageKey,
  locale: Locale,
  /** Route-level extras the CMS does not own: canonical, robots, openGraph. */
  extra: Metadata = {},
): Promise<Metadata> {
  const defaults = MASTER_PAGE_SEO_DEFAULTS[key];
  const stored = await getMasterPageSearchAppearance(key);
  const { meta_title, meta_description } = localiseSearchAppearance(
    stored,
    locale,
  );
  // A CMS title is always absolute (see above). The fallback keeps whatever
  // form the route published before: templated everywhere except the home
  // page, which has always shipped the layout's untemplated default.
  /*
   * The code-side fallback needs Arabic too.
   *
   * `localiseSearchAppearance` handles the CMS values; these are the strings a
   * page publishes when the CMS field is blank, which today is most of them.
   * Left alone, an Arabic page with no CMS meta gets an English title from
   * `MASTER_PAGE_SEO_DEFAULTS` — the same failure one layer down.
   */
  /*
   * All or nothing, per snippet.
   *
   * A result showing an Arabic title over an English description is worse than
   * one that is wholly English: it reads as broken rather than untranslated,
   * and it tells a searcher the page is in a language it is not. Three pages
   * would have shipped exactly that — their titles translated cleanly and
   * their descriptions were blocked by the gate.
   *
   * So the generated fallback applies only when BOTH halves have Arabic. A
   * twin an editor wrote is their decision and is not subject to this;
   * `localiseSearchAppearance` has already applied those.
   */
  const arTitle = locale === "ar" ? arabicFor(defaults.title) : null;
  const arDescription = locale === "ar" ? arabicFor(defaults.description) : null;
  const bothTranslated = Boolean(arTitle && arDescription);

  const fallbackTitle = (bothTranslated ? arTitle : null) ?? defaults.title;
  const fallbackDescription =
    (bothTranslated ? arDescription : null) ?? defaults.description;

  const title = meta_title
    ? { absolute: meta_title }
    : defaults.titleIsAbsolute
      ? { absolute: fallbackTitle }
      : fallbackTitle;

  return {
    title,
    description: meta_description ?? fallbackDescription,
    ...extra,
  };
}

/**
 * The title a master page publishes when the CMS field is blank, as a reader
 * would see it — template applied.
 *
 * The CMS preview needs this to be honest about the fallback: the route
 * declares `title: "Buy a Property in Abu Dhabi"` and the visitor reads
 * "Buy a Property in Abu Dhabi · Bazar", so showing the raw declaration would
 * under-count the length by the width of the suffix.
 */
export const TITLE_TEMPLATE_SUFFIX = " · Bazar";

export function withTitleTemplate(title: string): string {
  return title.endsWith(TITLE_TEMPLATE_SUFFIX)
    ? title
    : `${title}${TITLE_TEMPLATE_SUFFIX}`;
}

export type SearchPreviewChrome = {
  faviconUrl: string | null;
  brandName: string;
};

/**
 * The site icon and name the CMS preview draws, so the rehearsal shows the
 * operator's own branding rather than a placeholder. Same read the public
 * chrome does; falls back to the shipped defaults when Supabase is unset.
 */
export async function getSearchPreviewChrome(): Promise<SearchPreviewChrome> {
  const branding = await getPublicBranding(DEFAULT_LOCALE);
  return {
    faviconUrl:
      branding.search_logo_url ?? branding.favicon_url ?? branding.logo_url,
    brandName: branding.brand_name,
  };
}
