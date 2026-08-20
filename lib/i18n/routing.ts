import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";
import { isNonLocalisedPath } from "./non-localised";

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
 * Only *served* locales count as prefixes, which mattered while `LOCALES` was
 * `["en"]`: `/ar/anything` was then not a locale-prefixed path at all, just an
 * unprefixed path starting with the letters "ar", and it rewrote to
 * `/en/ar/anything` like everything else. That is what kept the one
 * hand-authored Arabic page serving from its physical route before the flip.
 *
 * `ar` is served now, so that no longer applies: `/ar/legal/privacy` resolves
 * as locale=ar + /legal/privacy and is answered by the branch in
 * `legal/privacy/page.tsx`. The physical route under `(public)/ar/` is now
 * reachable only as `/ar/ar/legal/privacy` — a live duplicate whose own
 * docblock says to delete it in the PR that added "ar" here. It outlived that
 * PR. See docs/FOLLOWUPS.md.
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
  return pathname === "/"
    ? `/${DEFAULT_LOCALE}`
    : `/${DEFAULT_LOCALE}${pathname}`;
}

/**
 * The locale-prefixed form of an `href`, or the href unchanged when prefixing
 * it would be wrong.
 *
 * This is the other half of the routing story. `proxy.ts` resolves the locale
 * of an *incoming* URL; this resolves the locale of an *outgoing* one — every
 * `<Link>` and `<a>` the site renders. Without it the locale is a property of
 * the page you are on rather than of the session: a visitor on `/ar/buy` sees
 * Arabic chrome, clicks "Insights", and lands on English `/insights`, because
 * the href was written `/insights` in 1997-style absolute form and nothing
 * rewrote it. Measured on `/ar/buy` before this existed: 46 of the page's 56
 * internal links pointed back into English.
 *
 * Six exemptions, and each one is a real page that breaks without it:
 *
 *   - **Not an internal path.** `https://…`, `mailto:`, `tel:`, `#anchor`, a
 *     relative `foo/bar`, and protocol-relative `//host/x`. Prefixing any of
 *     these produces a URL that resolves nowhere.
 *   - **Already prefixed.** `/ar/buy` must not become `/ar/ar/buy`. Links are
 *     built from `usePathname()` in several places, which is already
 *     visitor-facing and therefore already carries the prefix.
 *   - **Non-localised by contract.** `/api/*`, `/auth/*`, `/sso/*`, `/sold/*`,
 *     `/contact-qr/vcard`, `/opengraph-image` — the same list the proxy
 *     refuses to rewrite (`lib/i18n/non-localised.ts`). A prefixed `/ar/api/…`
 *     is a 404, and on a form POST that reads as the feature being broken
 *     rather than the link being wrong.
 *   - **The CMS.** English-only, permanently (ADR-0007), and the proxy
 *     redirects `/ar/admin` back to `/admin`. Prefixing it would mean every
 *     admin link taken from an Arabic public page costs a redirect.
 *   - **A file.** A last segment containing a dot is a static asset served
 *     from `public/`, and the proxy matcher deliberately does not see it, so
 *     `/ar/brochure.pdf` is a 404 rather than a redirect.
 *   - **The default locale.** English is served unprefixed, so this returns
 *     the href byte-identical and every English page keeps the exact HTML it
 *     has today. That is what makes this safe to apply site-wide in one pass.
 */
export function localiseHref(href: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return href;
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  // Split once, so query and hash ride along untouched. `/buy?a=1#x` has to
  // come back as `/ar/buy?a=1#x`, not lose its tail to a naive concat.
  const cut = href.search(/[?#]/);
  const pathname = cut === -1 ? href : href.slice(0, cut);
  const tail = cut === -1 ? "" : href.slice(cut);

  if (localeFromPathname(pathname)) return href;
  if (isNonLocalisedPath(pathname)) return href;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return href;
  if (hasFileExtension(pathname)) return href;

  return `${withLocalePrefix(pathname, locale)}${tail}`;
}

/** `/x/report.pdf` -> true, `/areas/al-reem` -> false. */
function hasFileExtension(pathname: string): boolean {
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return last.includes(".");
}

/**
 * Query param by which a link states "serve me this locale from now on".
 *
 * `proxy.ts` consumes it: it writes the choice to the preferences cookie,
 * strips the param, and redirects to the clean URL. So it exists for exactly
 * one hop and never reaches a page, a canonical, or an analytics event.
 */
export const SETLANG_PARAM = "setlang";

/**
 * The href for one option of the language switch.
 *
 * Three things have to survive into one URL and each was a real bug on its
 * own:
 *
 *   - the **target locale's path**, so switching on a listing lands on that
 *     listing rather than the home page;
 *   - the **current querystring**, so switching mid-search keeps the filters —
 *     this was documented as handled while the code dropped it, sending
 *     `/buy/search?beds=3&type=villa` to a bare `/ar/buy/search`;
 *   - the **choice itself**, so it sticks for the rest of the session instead
 *     of lasting exactly one page.
 *
 * `URLSearchParams` rather than string concatenation because `search` is
 * whatever the address bar holds — `""`, `"?a=1"`, or a `setlang` left over
 * from a URL the visitor copied mid-switch. Appending would produce a second
 * `setlang`, and `searchParams.get` returns the first, which is the stale one.
 */
export function localeSwitchHref(
  path: string,
  search: string,
  locale: Locale,
): string {
  const params = new URLSearchParams(search);
  params.set(SETLANG_PARAM, locale);
  return `${withLocalePrefix(path, locale)}?${params.toString()}`;
}
