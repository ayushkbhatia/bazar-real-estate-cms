"use client";

/**
 * Client-side price and area renderers for server-rendered surfaces.
 *
 * Every area in the schema is stored in ft² and every price in AED. Server
 * components can't read the visitor's `bz_prefs` cookie through
 * `usePreferences` — that would mean calling `cookies()` and losing ISR — so
 * anywhere a server component wants a preference-aware figure it drops one of
 * these in as the value instead of interpolating `AED` or `ft²` into a
 * template string.
 *
 * They render the AED/ft² text during SSR (the default preference) and swap
 * after hydration if that's what the visitor picked — same pattern as
 * `ListingCardPriced`.
 *
 * This is the whole toolkit; prefer it over making a server component client
 * just to reach the hook. `/market-reports/**` is the reference consumer.
 */

import {
  areaUnitLabel,
  currencySymbol,
  formatArea,
  formatAreaRange,
  formatMoneyValue,
  formatPrice,
  formatPricePerArea,
  formatPricePerAreaValue,
  usePreferences,
} from "@/lib/preferences";

/** "1,240 ft²" / "115 m²". Renders `fallback` when the value is missing. */
export function AreaText({
  ft2,
  fallback = "—",
}: {
  ft2: number | null | undefined;
  fallback?: string;
}) {
  const { prefs } = usePreferences();
  if (ft2 == null || !Number.isFinite(ft2)) return <>{fallback}</>;
  return <>{formatArea(ft2, prefs.area_unit)}</>;
}

/** "1,240 – 1,480 ft²". Renders nothing when both bounds are missing. */
export function AreaRangeText({
  fromFt2,
  toFt2,
  fallback = "—",
}: {
  fromFt2: number | null | undefined;
  toFt2: number | null | undefined;
  fallback?: string;
}) {
  const { prefs } = usePreferences();
  return <>{formatAreaRange(fromFt2, toFt2, prefs.area_unit) ?? fallback}</>;
}

/** Just the unit glyph, for headers like "Median AED/ft²". */
export function AreaUnitText() {
  const { prefs } = usePreferences();
  return <>{areaUnitLabel(prefs.area_unit)}</>;
}

/** Just the currency glyph — "AED" / "$". For table headers and unit suffixes. */
export function CurrencySymbolText() {
  const { prefs } = usePreferences();
  return <>{currencySymbol(prefs.currency)}</>;
}

/**
 * "AED 1,050,000" — money at full precision, no M/K compaction. For tables
 * and figures where the digits themselves are the point.
 */
export function MoneyText({
  aed,
  fallback = "—",
}: {
  aed: number | null | undefined;
  fallback?: string;
}) {
  const { prefs } = usePreferences();
  if (aed == null || !Number.isFinite(aed)) return <>{fallback}</>;
  return <>{formatMoneyValue(aed, prefs)}</>;
}

/** "AED 2.40M" — a price stored in AED, shown in the visitor's currency. */
export function PriceText({
  aed,
  fallback = "—",
}: {
  aed: number | null | undefined;
  fallback?: string;
}) {
  const { prefs } = usePreferences();
  if (aed == null || !Number.isFinite(aed)) return <>{fallback}</>;
  return <>{formatPrice(aed, prefs)}</>;
}

/** "AED 1,850/ft²" — rate and unit together, for a standalone figure. */
export function PricePerAreaUnitText({
  aedPerFt2,
  fallback = "—",
}: {
  aedPerFt2: number | null | undefined;
  fallback?: string;
}) {
  const { prefs } = usePreferences();
  if (aedPerFt2 == null || !Number.isFinite(aedPerFt2)) return <>{fallback}</>;
  return <>{formatPricePerArea(aedPerFt2, prefs)}</>;
}

/**
 * "AED 1,850" — the same rate as `PricePerAreaText` but with no trailing unit,
 * for a table whose column header already carries it.
 */
export function PricePerAreaValueText({
  aedPerFt2,
  fallback = "—",
}: {
  aedPerFt2: number | null | undefined;
  fallback?: string;
}) {
  const { prefs } = usePreferences();
  if (aedPerFt2 == null || !Number.isFinite(aedPerFt2)) return <>{fallback}</>;
  return (
    <>
      {currencySymbol(prefs.currency)}{" "}
      {formatPricePerAreaValue(aedPerFt2, prefs)}
    </>
  );
}

/**
 * "AED 18 / ft²" — a rate stored per ft² in AED, shown in the visitor's
 * currency per their area unit. ft² → m² multiplies because there are 10.76
 * ft² in a m², so the same money buys a bigger denominator.
 */
export function PricePerAreaText({
  aedPerFt2,
  fallback = "—",
  suffix = "",
}: {
  aedPerFt2: number | null | undefined;
  fallback?: string;
  /** Appended after the unit, e.g. " / yr". */
  suffix?: string;
}) {
  const { prefs } = usePreferences();
  if (aedPerFt2 == null || !Number.isFinite(aedPerFt2)) return <>{fallback}</>;
  return (
    <>
      {currencySymbol(prefs.currency)}{" "}
      {formatPricePerAreaValue(aedPerFt2, prefs)} /{" "}
      {areaUnitLabel(prefs.area_unit)}
      {suffix}
    </>
  );
}
