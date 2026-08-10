"use client";

/**
 * Client-side area renderers for server-rendered surfaces.
 *
 * Every area in the schema is stored in ft². Server components can't read the
 * visitor's `bz_prefs` cookie value through `usePreferences`, so anywhere a
 * server component wants a unit-aware figure it drops one of these in as the
 * value instead of interpolating `ft²` into a template string.
 *
 * They render the ft² text during SSR (the default preference) and swap to m²
 * after hydration if that's what the visitor picked — same pattern as
 * `ListingCardPriced` for prices.
 */

import {
  areaUnitLabel,
  convertFromAed,
  currencySymbol,
  formatArea,
  formatAreaRange,
  FT2_PER_M2,
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
  const inCurrency = convertFromAed(aedPerFt2, prefs.currency);
  const value = prefs.area_unit === "m2" ? inCurrency * FT2_PER_M2 : inCurrency;
  return (
    <>
      {currencySymbol(prefs.currency)} {Math.round(value).toLocaleString()} /{" "}
      {areaUnitLabel(prefs.area_unit)}
      {suffix}
    </>
  );
}
