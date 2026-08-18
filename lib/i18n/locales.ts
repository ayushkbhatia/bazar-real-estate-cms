/**
 * The locale lists, and the two path functions that depend on them.
 *
 * This is the single source of truth for `Locale`. `lib/preferences/types.ts`
 * re-exports it — that file reserved the type back when prefs shipped, with a
 * note saying the cookie shape was pre-sized for AR. This is that epic.
 *
 * TWO LISTS, deliberately:
 *
 *   ALL_LOCALES  every locale the code knows how to render. Widening this is
 *                what lets locale-aware branches (`locale === "ar"`) typecheck
 *                and be reviewed long before anything serves them.
 *   LOCALES      the locales actually served right now. Gates routing, the
 *                sitemap, `generateStaticParams`, and the navbar toggle.
 *
 * Arabic is now served. It is NOT indexed: `app/[locale]/layout.tsx` emits
 * `robots: noindex` for it and `robots.ts` disallows `/ar`, so the client can
 * review the whole site in Arabic without a single URL entering a search
 * index. Removing those two is the actual launch, and it is deliberately a
 * separate decision from making the pages exist.
 *
 * This split is also the kill switch: once `/ar` is indexed, un-shipping it is
 * a 410-and-Search-Console exercise rather than a flag flip, so the flag has to
 * exist before launch rather than after.
 */

export const ALL_LOCALES = ["en", "ar"] as const;

export type Locale = (typeof ALL_LOCALES)[number];

/** The locale served on unprefixed URLs. `/buy` is English; `/ar/buy` is not. */
export const DEFAULT_LOCALE = "en" satisfies Locale;

/**
 * Locales currently served.
 *
 * Arabic IS switched on. This paragraph described the decision to flip it and
 * was not updated when the flip happened, so it read as "not yet switched on"
 * directly above a list containing "ar".
 *
 * What the flip did NOT do is make Arabic public in the search sense: the
 * routes serve, but `app/[locale]/layout.tsx` still emits
 * `robots: { index: false, follow: false }` for `ar`, `app/robots.ts` still
 * carries `Disallow: /ar`, and `app/sitemap.ts` lists no `/ar` URL. That is
 * deliberate — the Arabic corpus is a machine first draft the client is still
 * reviewing (ADR-0008), and un-indexing is a 410-and-Search-Console exercise
 * rather than a revert. Removing the noindex is the remaining decision, and it
 * is a separate one from this list.
 *
 * Everything downstream loops over this list, so the flip is one line. It was
 * exercised locally against a full build before shipping: 234 /ar/* routes
 * prerendered alongside 234 /en/*, chrome mirrored, Arabic font loaded on
 * /ar/* and absent from English pages.
 */
export const LOCALES: readonly Locale[] = ["en", "ar"];

/** Text direction per locale. Arabic is the only RTL locale in scope. */
export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

/** Is this a locale we serve today? Use for routing and param validation. */
export function isEnabledLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

/** Is this a locale the code knows about, served or not? */
export function isKnownLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (ALL_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * The public URL of `path` in `locale` — what goes in an href, a canonical, a
 * sitemap entry or an hreflang alternate.
 *
 * We prefix as-needed: English keeps every URL it has today, Arabic gets `/ar`.
 * That is what lets all 82 existing URLs survive the move byte-identical.
 *
 *   localeUrl("/buy", "en") === "/buy"
 *   localeUrl("/buy", "ar") === "/ar/buy"
 *   localeUrl("/",    "ar") === "/ar"
 */
export function localeUrl(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * The cache key `revalidatePath()` needs for `path` in `locale`.
 *
 * NOT the same thing as `localeUrl`. Next prerenders English to `/en/buy` even
 * though it is *served* at `/buy`, so the revalidation key carries the segment
 * for every locale, including the default.
 *
 * This is the line P0 existed to make safe: 79 public call sites were routed
 * through `revalidateLocalised` a phase early, so flipping it here is a
 * one-function change rather than a sweep — and the paths those call sites
 * name never stop existing from their point of view.
 */
export function revalidateKey(path: string, locale: Locale): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/**
 * Coerce a route param to a Locale.
 *
 * `params.locale` is typed `string` because Next cannot know the segment's
 * shape. Anything unrecognised becomes English rather than throwing: the proxy
 * has already rejected unknown prefixes, so a surprise here means a bug in our
 * own routing, and rendering English is a better answer than a 500.
 */
export function asLocale(value: string): Locale {
  return (ALL_LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : DEFAULT_LOCALE;
}
