/**
 * FX rate constants. The plan calls for a daily Vercel cron pulling ECB rates
 * into a `fx_rates` row, but Phase 1 ships with static fallbacks driven by env
 * (`NEXT_PUBLIC_FX_USD_PER_AED`) so the popover works in dev without a DB
 * round-trip. When the cron lands, replace `loadRates()` with a Supabase read.
 *
 * Rates are expressed as "units of X per 1 AED" (AED → other), because every
 * price in the schema is stored in AED.
 */

import { usdPerAed } from "@/lib/env";
import type { Currency } from "./types";

/**
 * Mid-2026 spot fallbacks. EUR is approximated from USD/EUR ~ 0.92 EUR/USD.
 * Replace via cron in Phase 2 follow-up.
 */
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
