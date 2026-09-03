/**
 * Shared types for the user-preferences layer.
 *
 * `Locale` used to be declared here as a reservation for the AR + RTL epic.
 * That epic is now in flight, so the type moved to `lib/i18n/locales.ts` and
 * is re-exported here — one list of locales, not two that can drift apart.
 * The cookie shape is unchanged, exactly as the reservation intended.
 */

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

export type { Locale };

export type Currency = "AED" | "USD";
export type AreaUnit = "ft2" | "m2";

export const CURRENCIES: readonly Currency[] = ["AED", "USD"] as const;
export const AREA_UNITS: readonly AreaUnit[] = ["ft2", "m2"] as const;

/*
 * The three label maps that used to live here — `CURRENCY_LABEL`,
 * `CURRENCY_SYMBOL`, `AREA_UNIT_LABEL` — moved to `./unit-labels.ts`, keyed by
 * locale and overridable from `/admin/settings/units`. They are gone rather
 * than deprecated on purpose: a constant that still resolved would have gone on
 * rendering "AED" on Arabic pages, silently, which is the bug the dictionary
 * exists to end. Removing them makes every consumer a compile error instead.
 */

export type Preferences = {
  currency: Currency;
  area_unit: AreaUnit;
  locale: Locale;
};

export const DEFAULT_PREFERENCES: Preferences = {
  currency: "AED",
  area_unit: "ft2",
  locale: DEFAULT_LOCALE,
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

export function isAreaUnit(v: unknown): v is AreaUnit {
  return typeof v === "string" && (AREA_UNITS as readonly string[]).includes(v);
}
