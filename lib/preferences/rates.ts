/**
 * FX rates. Two currencies, one of them a peg — so there is nothing to fetch.
 *
 * Every price in the schema is stored in AED, so rates here are expressed as
 * "units of X per 1 AED".
 *
 * The AED has been pegged to the USD at **3.6725 AED/USD** since 1997. There
 * is no market rate to look up, no daily drift, and no env var: `USD_PER_AED`
 * is the exact reciprocal and is the only conversion the site performs.
 * (It previously came from `NEXT_PUBLIC_FX_USD_PER_AED`, defaulting to a
 * rounded 0.272 — 0.08% low, and a knob nobody should be able to turn.)
 *
 * EUR was offered briefly and removed: it floats, so it would have needed a
 * live source, a refresh path, and a stale-value story for a number that is
 * only ever decorative on a marketplace that prices in AED. See
 * docs/decisions/ADR-0006-currency-aed-usd-only.md before adding a third
 * currency — that ADR records what shipping a floating one actually costs.
 */

import type { Currency } from "./types";

/** The CBUAE peg. Fixed since 1997. */
export const AED_PER_USD = 3.6725;

/** Exact reciprocal of the peg — 1 AED in USD. */
export const USD_PER_AED = 1 / AED_PER_USD;

export const RATES: Record<Currency, number> = {
  AED: 1,
  USD: USD_PER_AED,
};

export function getRate(currency: Currency): number {
  return RATES[currency] ?? 1;
}

/** Convert AED → target currency. Always returns a positive finite number. */
export function convertFromAed(aed: number, currency: Currency): number {
  if (!Number.isFinite(aed)) return 0;
  return aed * getRate(currency);
}
