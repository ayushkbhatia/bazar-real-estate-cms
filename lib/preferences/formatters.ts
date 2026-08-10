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

export const FT2_PER_M2 = 10.7639;

/** The glyph for an area unit — "ft²" / "m²". */
export function areaUnitLabel(unit: AreaUnit = "ft2"): string {
  return unit === "m2" ? "m²" : "ft²";
}

/**
 * Convert an area stored in ft² (the schema unit) to the display unit,
 * unformatted. Use when the caller needs the number — e.g. to feed a range
 * slider, or to build a "1,240 – 1,480" span.
 */
export function convertArea(
  ft2: number,
  unit: AreaUnit = "ft2",
): number {
  if (!Number.isFinite(ft2)) return 0;
  return unit === "m2" ? ft2 / FT2_PER_M2 : ft2;
}

/**
 * Convert a display-unit area back to ft² for storage / query strings.
 * The URL contract stays ft² regardless of what the visitor is looking at,
 * so a shared link means the same thing for both of them.
 */
export function toFt2(value: number, unit: AreaUnit = "ft2"): number {
  if (!Number.isFinite(value)) return 0;
  return unit === "m2" ? value * FT2_PER_M2 : value;
}

/**
 * The bare number for an area, grouped but with no unit suffix. Pairs with
 * `areaUnitLabel` where the markup already renders the unit separately
 * (e.g. `ListingCard`, which puts it in its own span).
 */
export function formatAreaValue(
  ft2: number | null | undefined,
  unit: AreaUnit = "ft2",
): string {
  if (ft2 == null || !Number.isFinite(ft2)) return "—";
  return convertArea(ft2, unit).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

/**
 * Format a price stored in AED for display in the user's currency.
 *
 * Compact: prices ≥ 1M show as "AED 4.20M" / "$1.14M"
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
  return `${formatAreaValue(ft2, unit)} ${areaUnitLabel(unit)}`;
}

/**
 * Format a ft²-stored range as a single string — "1,240 – 1,480 ft²".
 * Collapses to one figure when only one bound is set, and returns null when
 * neither is, so callers can drop the segment entirely.
 */
export function formatAreaRange(
  fromFt2: number | null | undefined,
  toFt2Value: number | null | undefined,
  unit: AreaUnit = "ft2",
): string | null {
  const from = fromFt2 != null && Number.isFinite(fromFt2) ? fromFt2 : null;
  const to = toFt2Value != null && Number.isFinite(toFt2Value) ? toFt2Value : null;
  if (from == null && to == null) return null;
  if (from != null && to != null && from !== to) {
    return `${formatAreaValue(from, unit)} – ${formatAreaValue(to, unit)} ${areaUnitLabel(unit)}`;
  }
  return formatArea((from ?? to)!, unit);
}

/** Convenience: just the currency symbol for the active currency. */
export function currencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOL[currency];
}
