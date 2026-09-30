/**
 * Statement coverage (SPEC §2.3): the months a set of statement files covers,
 * against the months the application needs — C4's grid and failing check,
 * W8's grid and legend, and C4's prefilled message. Each file's period is
 * entered by staff (CMS-5); coverage is the union of those periods.
 *
 * Months are "YYYY-MM" throughout; periods come from `mortgage_files`
 * (`period_from` the first of a month, `period_to` the last).
 */

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const EN_MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "2026-03-01" or "2026-03" → "2026-03". */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

function parse(ym: string): { year: number; month: number } {
  return { year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)) };
}

function index(ym: string): number {
  const { year, month } = parse(ym);
  return year * 12 + (month - 1);
}

function fromIndex(i: number): string {
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** Every month the periods cover. A period without both ends covers nothing. */
export function coveredMonths(periods: readonly { from: string | null; to: string | null }[]): Set<string> {
  const out = new Set<string>();
  for (const p of periods) {
    if (!p.from || !p.to) continue;
    for (let i = index(monthOf(p.from)); i <= index(monthOf(p.to)); i++) out.add(fromIndex(i));
  }
  return out;
}

export type Coverage = {
  months: { month: string; received: boolean }[];
  have: number;
  total: number;
  received: string[];
  missing: string[];
  complete: boolean;
};

export function coverage(required: readonly string[], periods: readonly { from: string | null; to: string | null }[]): Coverage {
  const covered = coveredMonths(periods);
  const months = required.map((month) => ({ month, received: covered.has(month) }));
  const received = months.filter((m) => m.received).map((m) => m.month);
  const missing = months.filter((m) => !m.received).map((m) => m.month);
  return { months, have: received.length, total: required.length, received, missing, complete: missing.length === 0 };
}

/** True when the months run one after another with no gap. */
export function contiguous(months: readonly string[]): boolean {
  return months.every((m, i) => i === 0 || index(m) === index(months[i - 1]!) + 1);
}

/**
 * A span of months, short: "Jun 2026", "Jun – Aug 2026", "Sep 2025 – May 2026"
 * (W8's legend).
 */
export function formatMonthSpan(first: string, last: string): string {
  const a = parse(first);
  const b = parse(last);
  if (first === last) return `${EN_MONTHS[a.month - 1]} ${a.year}`;
  if (a.year === b.year) return `${EN_MONTHS[a.month - 1]} – ${EN_MONTHS[b.month - 1]} ${b.year}`;
  return `${EN_MONTHS[a.month - 1]} ${a.year} – ${EN_MONTHS[b.month - 1]} ${b.year}`;
}

/**
 * A statement file's label: "Sep–Nov 2025", "Dec–Feb 2026" — an en dash and
 * the year of the last month (cms/00-foundations §9); one month: "Mar 2026".
 */
export function formatPeriodChip(from: string, to: string): string {
  const a = parse(monthOf(from));
  const b = parse(monthOf(to));
  if (monthOf(from) === monthOf(to)) return `${EN_MONTHS[b.month - 1]} ${b.year}`;
  return `${EN_MONTHS[a.month - 1]}–${EN_MONTHS[b.month - 1]} ${b.year}`;
}

/** "September 2025 to May 2026" — prose, for the message C4 prefills. */
export function formatMonthProse(first: string, last: string): string {
  const a = parse(first);
  const b = parse(last);
  if (first === last) return `${EN_MONTHS_LONG[a.month - 1]} ${a.year}`;
  return `${EN_MONTHS_LONG[a.month - 1]} ${a.year} to ${EN_MONTHS_LONG[b.month - 1]} ${b.year}`;
}

/** A month's short name alone, for a coverage tile: "Sep". */
export function formatMonthAbbrev(ym: string): string {
  return EN_MONTHS[parse(ym).month - 1]!;
}

/** The month the dropdowns list: "Sep 2025". */
export function formatMonthShort(ym: string): string {
  const { year, month } = parse(ym);
  return `${EN_MONTHS[month - 1]} ${year}`;
}

/** First and last day of a month, for `mortgage_files.period_from` / `period_to`. */
export function monthBounds(ym: string): { first: string; last: string } {
  const { year, month } = parse(ym);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { first: `${ym}-01`, last: `${ym}-${String(last).padStart(2, "0")}` };
}

/** The months to offer for a file's period: the required ones and a year either side. */
export function periodChoices(required: readonly string[]): string[] {
  if (required.length === 0) return [];
  const start = index(required[0]!) - 12;
  const end = index(required.at(-1)!) + 1;
  const out: string[] = [];
  for (let i = start; i <= end; i++) out.push(fromIndex(i));
  return out;
}
