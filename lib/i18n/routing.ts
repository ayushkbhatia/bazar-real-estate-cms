import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

/**
 * Path helpers for as-needed locale prefixing.
 *
 * The shape: English is served on unprefixed URLs (`/buy`), every other locale
 * carries its prefix (`/ar/buy`). Internally the route tree lives under
 * `app/[locale]/`, so `/buy` is *rendered* by `/en/buy` — the proxy rewrites it
 * there. A rewrite, never a redirect: the visitor's URL must not change, and
 * the prerendered `/en/buy` artifact is what gets served (measured, not
 * assumed — see the P1 ISR spike).
 *
 * Only *served* locales count as prefixes. While `LOCALES` is `["en"]`,
 * `/ar/anything` is not a locale-prefixed path at all — it is an ordinary
 * unprefixed path that happens to start with the letters "ar", and it rewrites
 * to `/en/ar/anything` like everything else. That is deliberate: it is what
 * keeps the one hand-authored Arabic page (`/ar/legal/privacy`) serving from
 * its physical route until P3 moves it into the locale tree.
 */

/** The served locale a path is prefixed with, or null if it is unprefixed. */
export function localeFromPathname(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];
  if (!segment) return null;
  return LOCALES.includes(segment as Locale) ? (segment as Locale) : null;
}

/** `/ar/buy` -> `/buy`. An unprefixed path is returned unchanged. */
export function stripLocalePrefix(pathname: string): string {
  const locale = localeFromPathname(pathname);
  if (!locale) return pathname;
  const rest = pathname.slice(locale.length + 1);
  return rest === "" ? "/" : rest;
}

/** `/buy` + `ar` -> `/ar/buy`. The default locale stays unprefixed. */
export function withLocalePrefix(pathname: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return pathname;
  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}

/**
 * The internal path that renders `pathname` — i.e. what the proxy rewrites to.
 * Always carries a locale segment, including for the default locale, because
 * the route tree lives under `app/[locale]/` and `.next/server/app/en/buy` is
 * the artifact that has to be hit.
 */
export function internalPath(pathname: string): string {
  const locale = localeFromPathname(pathname);
  if (locale) return pathname; // already prefixed — the router matches it directly
  return pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
}
