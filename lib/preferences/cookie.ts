/**
 * Cookie serialization for preferences. Single source of truth so the server
 * (root layout) and client (provider) read the same value off the wire.
 *
 * Cookie name: `bz_prefs`. Value format: `c=USD&a=m2&l=ar`. We deliberately
 * keep the format compact so it stays well under the 4 KB cookie budget and is
 * human-debuggable from devtools.
 *
 * `l` was reserved-but-unwritten until Arabic shipped, and it carries a
 * responsibility the other two do not: `proxy.ts` reads it on every request to
 * decide whether an unprefixed URL should be redirected into `/ar`. So this
 * file is now edge-runtime code as well as browser code — keep it free of
 * Node built-ins, and keep `decodePrefs` total. A cookie this parser throws on
 * would take down every page on the site rather than one preference.
 *
 * Only *served* locales decode. A stale `l=fr` from some future experiment
 * falls back to English rather than redirecting visitors into a 404.
 */

import { isEnabledLocale, type Locale } from "@/lib/i18n/locales";
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  isCurrency,
  isAreaUnit,
} from "./types";

export const PREFS_COOKIE = "bz_prefs";
export const PREFS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function encodePrefs(prefs: Preferences): string {
  const parts: string[] = [];
  if (prefs.currency !== DEFAULT_PREFERENCES.currency) parts.push(`c=${prefs.currency}`);
  if (prefs.area_unit !== DEFAULT_PREFERENCES.area_unit) parts.push(`a=${prefs.area_unit}`);
  if (prefs.locale !== DEFAULT_PREFERENCES.locale) parts.push(`l=${prefs.locale}`);
  return parts.join("&");
}

export function decodePrefs(raw: string | null | undefined): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  const out = { ...DEFAULT_PREFERENCES };
  for (const segment of raw.split("&")) {
    const [k, v] = segment.split("=");
    if (k === "c" && isCurrency(v)) out.currency = v;
    if (k === "a" && isAreaUnit(v)) out.area_unit = v;
    if (k === "l" && isEnabledLocale(v)) out.locale = v;
  }
  return out;
}

/**
 * The locale a visitor has explicitly chosen, or null if they never have.
 *
 * Null and "en" are different answers and the proxy needs both: a visitor who
 * has never touched the switch gets today's behaviour untouched, while one who
 * chose English gets it *pinned*, which is what lets them escape a sticky
 * Arabic session. Folding the two together would make the English half of the
 * language switch a no-op.
 *
 * Takes the raw cookie value rather than a request, so it can be unit-tested
 * and so this file stays free of `next/server`.
 */
export function chosenLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  for (const segment of raw.split("&")) {
    const [k, v] = segment.split("=");
    if (k === "l" && isEnabledLocale(v)) return v;
  }
  return null;
}
