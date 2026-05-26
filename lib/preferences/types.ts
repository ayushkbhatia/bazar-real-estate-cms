/**
 * Shared types for the user-preferences layer.
 *
 * AR locale + RTL is a separate post-Tier-1 epic (see plan §"Decisions locked").
 * Phase 1 only ships currency + area unit. The `Locale` type is reserved here
 * so the cookie shape doesn't need to change when AR lands.
 */

export type Currency = "AED" | "USD" | "EUR";
export type AreaUnit = "ft2" | "m2";
export type Locale = "en";

export const CURRENCIES: readonly Currency[] = ["AED", "USD", "EUR"] as const;
export const AREA_UNITS: readonly AreaUnit[] = ["ft2", "m2"] as const;

export const CURRENCY_LABEL: Record<Currency, string> = {
  AED: "AED · UAE Dirham",
  USD: "USD · US Dollar",
  EUR: "EUR · Euro",
};

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  AED: "AED",
  USD: "$",
  EUR: "€",
};

export const AREA_UNIT_LABEL: Record<AreaUnit, string> = {
  ft2: "Square feet (ft²)",
  m2: "Square metres (m²)",
};

export type Preferences = {
  currency: Currency;
  area_unit: AreaUnit;
  locale: Locale;
};

export const DEFAULT_PREFERENCES: Preferences = {
  currency: "AED",
  area_unit: "ft2",
  locale: "en",
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

export function isAreaUnit(v: unknown): v is AreaUnit {
  return typeof v === "string" && (AREA_UNITS as readonly string[]).includes(v);
}
