/**
 * A handover date as the two numbers a sentence needs, rather than as English.
 *
 * `quarterLabel` in `lib/schemas/development.ts` returns the finished string
 * "Q4 2029". That is the right shape for the CMS tables and for the lead
 * tokens an advisor reads, and the wrong one for a public page: the quarter
 * name is prose, and baking it into a helper put five public surfaces beyond
 * the reach of the message catalogue. On /ar the off-plan cards read
 * "Handover Q4 2029" in the middle of an Arabic paragraph.
 *
 * So the public path takes the numbers and lets ICU write the words —
 * `development.card.quarter` picks الربع الرابع or Q4 by locale, and the year
 * is passed as a STRING so it is not number-formatted into "2,029".
 */

export type HandoverQuarter = { q: number; year: number };

/** `"2029-11-01"` → `{ q: 4, year: 2029 }`; null when there is no usable date. */
export function handoverQuarter(
  iso: string | null | undefined,
): HandoverQuarter | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { q: Math.floor(d.getUTCMonth() / 3) + 1, year: d.getUTCFullYear() };
}

/** The ICU arguments for `development.card.quarter` / `.handover`. */
export function quarterArgs(quarter: HandoverQuarter): {
  q: string;
  year: string;
} {
  return { q: String(quarter.q), year: String(quarter.year) };
}
