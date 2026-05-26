/**
 * Pure formatting helpers that consume preferences. No React, no DB.
 *
 * The legacy `formatAed` / `formatFt2` in `lib/compare.ts` stay untouched for
 * backwards compatibility — they hard-code AED + ft² and are used by surfaces
 * that haven't been migrated yet. New surfaces should use the helpers here.
 */

import type { AreaUnit, Currency, Preferences } from "./types";
import { CURRENCY_SYMBOL } from "./types";
import { convertFromAed } from "./rates";

const FT2_PER_M2 = 10.7639;

/**
 * Format a price stored in AED for display in the user's currency.
 *
 * Compact: prices ≥ 1M show as "AED 4.20M" / "$1.14M" / "€1.05M"
 * Mid: 1K → "AED 750K"
 * Below 1K: locale-grouped, e.g. "AED 500"
 */
export function formatPrice(
  aed: number | null | undefined,
  prefs: Pick<Preferences, "currency"> = { currency: "AED" },
): string {
  if (aed == null || !Number.isFinite(aed)) return "—";
  const target = convertFromAed(aed, prefs.currency);
  const symbol = CURRENCY_SYMBOL[prefs.currency];
  // Match the existing AED formatter shape so swapping in is a no-op visually
  if (target >= 1_000_000) return `${symbol} ${(target / 1_000_000).toFixed(2)}M`;
  if (target >= 1_000) return `${symbol} ${(target / 1_000).toFixed(0)}K`;
  return `${symbol} ${target.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Format AED/ft² (the canonical schema unit) for display in the user's
 * currency-per-area-unit.
 */
export function formatPricePerArea(
  aedPerFt2: number | null | undefined,
  prefs: Preferences,
): string {
  if (aedPerFt2 == null || !Number.isFinite(aedPerFt2)) return "—";
  const inCurrency = convertFromAed(aedPerFt2, prefs.currency);
  // ft² → m² is a multiplication by 10.7639 because there are 10.76 ft² per m²
  const final = prefs.area_unit === "m2" ? inCurrency * FT2_PER_M2 : inCurrency;
  const symbol = CURRENCY_SYMBOL[prefs.currency];
  const unit = prefs.area_unit === "m2" ? "m²" : "ft²";
  return `${symbol} ${Math.round(final).toLocaleString()}/${unit}`;
}

/**
 * Format an area stored in ft² for display in the user's chosen unit.
 */
export function formatArea(
  ft2: number | null | undefined,
  unit: AreaUnit = "ft2",
): string {
  if (ft2 == null || !Number.isFinite(ft2)) return "—";
  if (unit === "m2") {
    const m2 = ft2 / FT2_PER_M2;
    return `${m2.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²`;
  }
  return `${ft2.toLocaleString()} ft²`;
}

/** Convenience: just the currency symbol for the active currency. */
export function currencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOL[currency];
}
