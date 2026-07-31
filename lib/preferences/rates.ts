/**
 * FX rates. Static by design.
 *
 * The AED is pegged to the USD at 3.6725 AED/USD and has been since 1997, so
 * USD conversion is a constant, not a market rate. A daily cron once existed to
 * pull ECB rates, but it only ever wrote to module memory that nothing read —
 * these constants were always what the site used. The cron was removed rather
 * than wired up, because there is nothing for it to do.
 *
 * Rates are expressed as "units of X per 1 AED" (AED → other), because every
 * price in the schema is stored in AED.
 *
 * CAVEAT: the EUR is NOT pegged to the AED — it floats against the dollar, so
 * the figure below drifts. It is a display convenience on a marketplace that
 * prices in AED, not a quote. If EUR accuracy ever matters, it needs a live
 * source; USD never will.
 */

import { usdPerAed } from "@/lib/env";
import type { Currency } from "./types";

/** USD is the peg (1 / 3.6725). EUR is approximated at ~0.92 EUR/USD. */
const FALLBACK_RATES: Record<Currency, number> = {
  AED: 1,
  USD: 0.272,
  EUR: 0.25, // ≈ 0.272 USD/AED × 0.92 EUR/USD
};

export function getRate(currency: Currency): number {
  if (currency === "AED") return 1;
  if (currency === "USD") return usdPerAed();
  if (currency === "EUR") return FALLBACK_RATES.EUR;
  return 1;
}

/** Convert AED → target currency. Always returns a positive finite number. */
export function convertFromAed(aed: number, currency: Currency): number {
  if (!Number.isFinite(aed)) return 0;
  return aed * getRate(currency);
}
