/**
 * Pure formatting helpers that consume preferences. No React, no DB.
 *
 * These are the only price/area formatters on the public site. The legacy
 * hard-AED helpers they replaced (`formatAed` / `formatFt2` in `lib/compare.ts`,
 * and a scattering of per-file `formatAed` copies) are gone.
 *
 * `formatPriceAED` in `lib/queries/property-utils.ts` survives for the surfaces
 * that have no visitor to ask — admin tables, OG images, `generateMetadata`,
 * email. `formatPrice(x, { currency: "AED" })` is byte-identical to it, and
 * `preferences.test.ts` pins that equivalence.
 */

import type { AreaUnit, Currency } from "./types";
import {
  labelsOf,
  type AreaLabels,
  type PriceLabels,
  type UnitLabelsCtx,
} from "./unit-labels";
import { convertFromAed, getRate } from "./rates";

export const FT2_PER_M2 = 10.7639;

/**
 * Every figure is grouped in en-US, never the ambient locale.
 *
 * `toLocaleString()` with no locale resolves from ICU on the server and from
 * `navigator.language` in the browser. Those are entitled to disagree — a
 * de-DE visitor would get `1,180` from SSR and `1.180` after hydration, a text
 * mismatch on every card. The document is `<html lang="en">`, so pin it.
 * `lib/queries/area-map.ts` already did this; this makes it uniform.
 */
const LOCALE = "en-US";

/**
 * Join an already-formatted figure to its currency token, on the side the
 * language puts it.
 *
 * English leads — "AED 4.2M". Arabic trails — "4.2M درهم". The site renders
 * these inside `.mono`, which `globals.css` isolates as an LTR run on Arabic
 * pages so a trailing "+" or "/" cannot be reordered away from its number; that
 * isolation is what makes the order here a decision the string has to make
 * rather than one the bidi algorithm will make later.
 */
export function withCurrency(figure: string, prefs: PriceLabels): string {
  const symbol = labelsOf(prefs).currency[prefs.currency];
  return labelsOf(prefs).currencyLeads
    ? `${symbol} ${figure}`
    : `${figure} ${symbol}`;
}

/**
 * The glyph for an area unit — "ft²" / "m²", or whatever the dictionary says
 * in the visitor's language.
 *
 * Takes the preferences object rather than the bare unit it used to take. That
 * is the point: `areaUnitLabel(prefs.area_unit)` no longer compiles, so the
 * typechecker names every surface that draws this word instead of leaving them
 * to be found by grep. See `unit-labels.ts`.
 */
export function areaUnitLabel(
  prefs: AreaLabels = { area_unit: "ft2" },
): string {
  return labelsOf(prefs).area[prefs.area_unit];
}

/**
 * Convert an area stored in ft² (the schema unit) to the display unit,
 * unformatted. Use when the caller needs the number — e.g. to feed a range
 * slider, or to build a "1,240 – 1,480" span.
 */
export function convertArea(ft2: number, unit: AreaUnit = "ft2"): number {
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
  return convertArea(ft2, unit).toLocaleString(LOCALE, {
    maximumFractionDigits: 0,
  });
}

/**
 * Format a price stored in AED for display in the user's currency.
 *
 * Compact: prices ≥ 1M show as "AED 4.2M" / "$ 1.14M"
 * Mid: 1K → "AED 750K"
 * Below 1K: grouped, e.g. "AED 500"
 *
 * The decimal count is per-currency, and deliberately so. One AED is worth
 * 1/3.6725 of a dollar, so `AED 7.9M` and `$ 2.16M` carry comparable
 * resolution — two decimals on both would make the USD figure 3.7× coarser.
 * It also keeps the AED branch byte-identical to the `formatPriceAED` that
 * still serves admin, OG images and metadata, so the two can never drift into
 * quoting the same listing at two prices.
 */
export function formatPrice(
  aed: number | null | undefined,
  prefs: PriceLabels = { currency: "AED" },
): string {
  if (aed == null || !Number.isFinite(aed)) return "—";
  const target = convertFromAed(aed, prefs.currency);
  if (target >= 1_000_000) {
    const dp = prefs.currency === "AED" ? 1 : 2;
    return withCurrency(`${(target / 1_000_000).toFixed(dp)}M`, prefs);
  }
  if (target >= 1_000)
    return withCurrency(`${(target / 1_000).toFixed(0)}K`, prefs);
  return withCurrency(
    target.toLocaleString(LOCALE, { maximumFractionDigits: 0 }),
    prefs,
  );
}

/**
 * Money at full precision — "AED 1,050,000" / "$ 285,910". For tables and
 * calculators, where a compacted "4.2M" would hide the digits the visitor is
 * there to read.
 */
export function formatMoneyValue(
  aed: number | null | undefined,
  prefs: PriceLabels = { currency: "AED" },
): string {
  if (aed == null || !Number.isFinite(aed)) return "—";
  const target = convertFromAed(aed, prefs.currency);
  return withCurrency(Math.round(target).toLocaleString(LOCALE), prefs);
}

/**
 * A rate stored as AED/ft², converted to the visitor's currency per their
 * area unit, with no symbol and no unit suffix. For a table or list whose
 * header already carries both.
 */
export function formatPricePerAreaValue(
  aedPerFt2: number | null | undefined,
  prefs: UnitLabelsCtx,
): string {
  if (aedPerFt2 == null || !Number.isFinite(aedPerFt2)) return "—";
  const inCurrency = convertFromAed(aedPerFt2, prefs.currency);
  // ft² → m² multiplies by 10.7639: there are 10.76 ft² in a m², so the same
  // money buys a bigger denominator.
  const final = prefs.area_unit === "m2" ? inCurrency * FT2_PER_M2 : inCurrency;
  return Math.round(final).toLocaleString(LOCALE);
}

/**
 * The same rate with its symbol and unit — "AED 1,850/ft²", "$ 5,424/m²",
 * "1,850 درهم/قدم²".
 */
export function formatPricePerArea(
  aedPerFt2: number | null | undefined,
  prefs: UnitLabelsCtx,
): string {
  if (aedPerFt2 == null || !Number.isFinite(aedPerFt2)) return "—";
  const rate = `${formatPricePerAreaValue(aedPerFt2, prefs)}/${areaUnitLabel(prefs)}`;
  return withCurrency(rate, prefs);
}

/**
 * Format an area stored in ft² for display in the user's chosen unit.
 *
 * The unit always trails the number, in both languages — "1,240 ft²",
 * "1,240 قدم²". Unlike money, which leads in English and trails in Arabic,
 * a measurement reads the same way round in both.
 */
export function formatArea(
  ft2: number | null | undefined,
  prefs: AreaLabels = { area_unit: "ft2" },
): string {
  if (ft2 == null || !Number.isFinite(ft2)) return "—";
  return `${formatAreaValue(ft2, prefs.area_unit)} ${areaUnitLabel(prefs)}`;
}

/**
 * Format a ft²-stored range as a single string — "1,240 – 1,480 ft²".
 * Collapses to one figure when only one bound is set, and returns null when
 * neither is, so callers can drop the segment entirely.
 */
export function formatAreaRange(
  fromFt2: number | null | undefined,
  toFt2Value: number | null | undefined,
  prefs: AreaLabels = { area_unit: "ft2" },
): string | null {
  const unit = prefs.area_unit;
  const from = fromFt2 != null && Number.isFinite(fromFt2) ? fromFt2 : null;
  const to =
    toFt2Value != null && Number.isFinite(toFt2Value) ? toFt2Value : null;
  if (from == null && to == null) return null;
  if (from != null && to != null && from !== to) {
    return `${formatAreaValue(from, unit)} – ${formatAreaValue(to, unit)} ${areaUnitLabel(prefs)}`;
  }
  return formatArea((from ?? to)!, prefs);
}

/**
 * Just the currency token for the active currency — "AED", "$", "درهم".
 *
 * For markup that positions the token itself (a table header, an input
 * adornment). Where the markup does NOT already decide the order, prefer
 * `formatPrice` / `formatMoneyValue`, which know that Arabic puts the currency
 * after the figure and English puts it before.
 */
export function currencySymbol(prefs: PriceLabels): string {
  return labelsOf(prefs).currency[prefs.currency];
}

/**
 * Convert a display-currency amount back to AED, for input boundaries. The
 * inverse of `convertFromAed`.
 */
export function toAed(value: number, currency: Currency): number {
  if (!Number.isFinite(value)) return 0;
  return value / getRate(currency);
}

/**
 * Query-param ↔ input-box converters for money, mirroring the `ft2_min` /
 * `ft2_max` pair in `more-filters-drawer.tsx`.
 *
 * `price_min` / `price_max` are always AED — a shared search URL has to mean
 * the same thing whatever currency the recipient prefers, and the consumer
 * (`lib/queries/properties.ts`) reads them as AED. These convert only at the
 * boundary, so a USD visitor types dollars into a box that writes dirhams.
 *
 * Rounding is lossless in the direction that matters and only that one:
 *
 * - **USD → AED → USD is exact.** After `Math.round`, the AED figure is within
 *   0.5 of the true product, so dividing back lands within 0.5/3.6725 = 0.136
 *   of the original dollar integer. Verified exhaustively over 1..200,000 in
 *   `preferences.test.ts`. This is the visitor's own round-trip: what they
 *   type is what the box reads back off the URL.
 * - **AED → USD → AED drifts by up to 2 AED**, because the dollar step
 *   compresses the range and the dirham digits are simply gone. So a caller
 *   must never push a price param back through the converters unless the
 *   visitor actually edited that box — passing an untouched param through
 *   would silently nudge someone else's shared search bounds.
 */
export function priceParamToInput(raw: string, currency: Currency): string {
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(convertFromAed(n, currency)));
}

export function inputToPriceParam(raw: string, currency: Currency): string {
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(toAed(n, currency)));
}
