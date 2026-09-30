/**
 * Monthly payments for bank offers (C5's "25 yrs · monthly" column).
 *
 * The formula is the mortgage calculator's, `monthlyPayment` in lib/mortgage.ts
 * (M = P·r(1+r)^n / ((1+r)^n − 1), rounded to whole dirhams), so the decision
 * screen and /tools/mortgage can never disagree. The payment is computed,
 * never stored (SPEC §3).
 */

import { monthlyPayment } from "@/lib/mortgage";

export { monthlyPayment };

/** Bank offers are compared over 25 years (C5). */
export const OFFER_TERM_YEARS = 25;

/** A bank offer's monthly payment: AED 2,150,000 at 3.99% is AED 11,337. */
export function offerMonthlyPayment(principalAed: number, ratePct: number): number {
  return monthlyPayment(principalAed, ratePct, OFFER_TERM_YEARS);
}
