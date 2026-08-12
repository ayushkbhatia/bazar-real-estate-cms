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
 * Arabic is written and reviewable but not yet served, so it is in the first
 * list and not the second. Enabling it in P3 is one line here.
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
 * Arabic is BUILT and verified but not yet switched on: adding "ar" here is
 * the public launch — it puts /ar/* in the sitemap, emits hreflang pointing at
 * it, and makes it indexable. Once indexed, un-shipping is a 410-and-Search-
 * Console exercise rather than a revert, which is why the flag exists and why
 * flipping it is a decision rather than a step.
 *
 * Everything downstream loops over this list, so the flip is one line. It was
 * exercised locally against a full build before shipping: 234 /ar/* routes
 * prerendered alongside 234 /en/*, chrome mirrored, Arabic font loaded on
 * /ar/* and absent from English pages.
 */
export const LOCALES: readonly Locale[] = ["en"];

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
