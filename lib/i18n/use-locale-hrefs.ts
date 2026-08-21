"use client";

import { usePathname } from "next/navigation";

import { useSearchSuffix } from "./use-search-suffix";
import { localeSwitchHref, stripLocalePrefix } from "./routing";
import type { Locale } from "./locales";

/**
 * The href a locale control points each of its options at.
 *
 * There are three presentations of the one decision now — the header pill
 * (`LocaleToggle`), the preferences list (`LanguageSwitch`) and the QR contact
 * card's EN/AR pill (`CardLocaleToggle`) — and every one of them has to get
 * three separate things right: keep the path, keep the querystring, and carry
 * the `?setlang=` that makes the choice outlive the click. Each was a real bug
 * on its own, and `locale-switch.test.tsx` exists because the second one was
 * documented as handled while the code dropped it.
 *
 * Two copies of that were already one too many. This is the single place the
 * href is built, so a control cannot be added with two of the three.
 *
 * ## Why `usePathname`, not `useLocale`
 *
 * Same reason as `components/i18n/link.tsx`: the locale IS the URL, the
 * pathname is available without a provider, and `usePathname` — unlike
 * `useSearchParams` — does not opt its subtree out of static rendering. That
 * matters because two of the three consumers render in the `(public)` layout,
 * i.e. on every prerendered route. `npm run check:routes` is the guard.
 *
 * The returned builder is a plain closure rather than a memoised callback: it
 * is called once per served locale during render and never handed to an effect
 * or a dependency array, so a stable identity would buy nothing.
 */
export function useLocaleHrefs(): (locale: Locale) => string {
  const pathname = usePathname();
  // Carried so a locale switch mid-search keeps the filters.
  const suffix = useSearchSuffix();

  // `usePathname` is already the visitor-facing path — unprefixed for English,
  // `/ar/…` for Arabic. Strip whatever is there before re-prefixing so the two
  // cannot compound into `/ar/ar/…`.
  const bare = stripLocalePrefix(pathname ?? "/");

  return (locale) => localeSwitchHref(bare, suffix, locale);
}
