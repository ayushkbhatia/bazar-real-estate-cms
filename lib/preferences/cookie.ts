/**
 * Cookie serialization for preferences. Single source of truth so the server
 * (root layout) and client (provider) read the same value off the wire.
 *
 * Cookie name: `bz_prefs`. Value format: `c=USD&a=m2`.  Locale is omitted from
 * the cookie until AR locale ships.  We deliberately keep the format compact
 * so it stays well under the 4 KB cookie budget and is human-debuggable from
 * devtools.
 */

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
  return parts.join("&");
}

export function decodePrefs(raw: string | null | undefined): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  const out = { ...DEFAULT_PREFERENCES };
  for (const segment of raw.split("&")) {
    const [k, v] = segment.split("=");
    if (k === "c" && isCurrency(v)) out.currency = v;
    if (k === "a" && isAreaUnit(v)) out.area_unit = v;
  }
  return out;
}
