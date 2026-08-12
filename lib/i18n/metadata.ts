import { LOCALES, localeUrl, type Locale } from "./locales";
import { env } from "@/lib/env";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae";

/** BCP-47 tags. The region matters: this is a UAE site, not generic Arabic. */
const HREFLANG: Record<Locale, string> = {
  en: "en-AE",
  ar: "ar-AE",
};

/**
 * `alternates` for a page, derived from its locale-agnostic path.
 *
 * Every localised page must spread this into its metadata. Without it Google
 * sees two URLs serving the same content in different languages and no
 * statement that they are translations of each other — which at best splits
 * ranking signal between them and at worst reads as duplicate content.
 *
 * Derived from the English path rather than stored, so it costs no query and
 * cannot drift out of sync with the routing.
 *
 * `x-default` points at English: it is what a visitor with no matching
 * language preference should land on.
 */
export function localeAlternates(path: string, locale: Locale) {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    languages[HREFLANG[l]] = `${SITE_URL}${localeUrl(path, l)}`;
  }
  languages["x-default"] = `${SITE_URL}${localeUrl(path, "en")}`;

  return {
    canonical: `${SITE_URL}${localeUrl(path, locale)}`,
    languages,
  };
}

/** The `alternates` block for a sitemap entry. */
export function sitemapAlternates(path: string) {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    languages[HREFLANG[l]] = `${SITE_URL}${localeUrl(path, l)}`;
  }
  return { languages };
}

/**
 * The BCP-47 tag for JSON-LD `inLanguage`.
 *
 * There are zero `inLanguage` properties in the structured data today. Without
 * it, Google reads an Arabic page's schema as English — and for the FAQ
 * emitters that means an Arabic URL surfacing a rich result with English
 * answers, which is worse than emitting no schema at all.
 */
export function jsonLdLanguage(locale: Locale): string {
  return HREFLANG[locale];
}
