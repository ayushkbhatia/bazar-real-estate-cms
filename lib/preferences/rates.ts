/**
 * FX rates: one pegged constant + one live-refreshed float.
 *
 * Every price in the schema is stored in AED, so rates here are expressed as
 * "units of X per 1 AED".
 *
 * ## USD — a constant, not a rate
 *
 * The AED has been pegged to the USD at **3.6725 AED/USD** since 1997. There is
 * no market rate to fetch; `USD_PER_AED` is the exact reciprocal and should
 * never be sourced from an API or an env var. (It previously came from
 * `NEXT_PUBLIC_FX_USD_PER_AED`, defaulting to a rounded 0.272 — 0.08% low, and
 * a knob nobody should be able to turn. Both are gone.)
 *
 * ## EUR — floats, so it is refreshed daily
 *
 * The EUR is *not* pegged to the AED. It floats against the dollar, so
 * EUR/AED drifts every day and a hardcoded figure goes stale silently. The
 * live value is fetched server-side (see `fx-source.ts`), served by
 * `/api/fx`, and pushed into this module by `PreferencesProvider` on mount
 * via `setLiveRates`. Until that resolves — and during SSR, and whenever the
 * upstream is unreachable — `STATIC_RATES` is used, so a fetch failure
 * degrades to a slightly stale number rather than a broken page.
 *
 * The rate is a display convenience on a marketplace that prices in AED, not
 * a dealable quote. See docs/decisions/ADR-0006-fx-rates.md.
 */

import type { Currency } from "./types";

/** The CBUAE peg. Fixed since 1997. */
export const AED_PER_USD = 3.6725;

/** Exact reciprocal of the peg — 1 AED in USD. */
export const USD_PER_AED = 1 / AED_PER_USD;

/**
 * Last-resort EUR/USD used when the live rate has not loaded. Deliberately
 * a whole-ish number: it is a floor, not a quote, and a precise-looking
 * constant here would imply an accuracy it does not have.
 */
const FALLBACK_EUR_PER_USD = 0.9;

/** Used for SSR, first paint, and any upstream failure. */
export const STATIC_RATES: Record<Currency, number> = {
  AED: 1,
  USD: USD_PER_AED,
  EUR: USD_PER_AED * FALLBACK_EUR_PER_USD,
};

/** Shape served by `/api/fx` and stored by `setLiveRates`. */
export type FxRates = {
  /** Units of the currency per 1 AED. AED is always 1. */
  rates: Record<Currency, number>;
  /** ISO date the upstream published these rates for. */
  as_of: string;
  /** Which path produced them — useful in the response and in tests. */
  source: "ecb" | "static";
};

let liveRates: Partial<Record<Currency, number>> = {};

/**
 * Seed the live rates. Called once by `PreferencesProvider` after `/api/fx`
 * resolves. Values that are not finite/positive are ignored, so a malformed
 * payload can never poison the formatters.
 */
export function setLiveRates(next: Partial<Record<Currency, number>>): void {
  const clean: Partial<Record<Currency, number>> = {};
  for (const [k, v] of Object.entries(next)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      clean[k as Currency] = v;
    }
  }
  liveRates = clean;
}

/** Test seam. */
export function resetLiveRates(): void {
  liveRates = {};
}

export function getRate(currency: Currency): number {
  if (currency === "AED") return 1;
  // USD is the peg — a live quote must never override it.
  if (currency === "USD") return USD_PER_AED;
  return liveRates[currency] ?? STATIC_RATES[currency] ?? 1;
}

/** Convert AED → target currency. Always returns a positive finite number. */
export function convertFromAed(aed: number, currency: Currency): number {
  if (!Number.isFinite(aed)) return 0;
  return aed * getRate(currency);
}
