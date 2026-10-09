/**
 * The date-of-birth picker's arithmetic (W2): which days a month shows, in
 * which week, and which of them can be chosen. Plain ISO dates ("1990-03-14")
 * and UTC throughout, so a browser's time zone never moves a birthday.
 */

export type CalendarDay = { iso: string; day: number; disabled: boolean };

/** A week, Monday first; `null` pads the days before the 1st and after the last. */
export type CalendarWeek = (CalendarDay | null)[];

const two = (n: number) => String(n).padStart(2, "0");

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${two(month + 1)}-${two(day)}`;
}

/** `{ year, month }` (month 0–11) of an ISO date, or null. */
export function monthOf(iso: string | null | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso ?? "");
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : null;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The weeks of a month, Monday first (the UAE's working week starts on
 * Monday). A day on or after `todayIso` is disabled: a date of birth is in
 * the past (`dobRule`).
 */
export function monthGrid(year: number, month: number, todayIso: string): CalendarWeek[] {
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const cells: (CalendarDay | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const iso = isoDate(year, month, day);
    cells.push({ iso, day, disabled: iso >= todayIso });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** An ISO date moved by whole days, for the grid's arrow keys. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** An ISO date moved by whole months, the day clamped to the new month's length (31 Mar − 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth();
  return isoDate(year, month, Math.min(d, daysInMonth(year, month)));
}

/** The years the picker offers, newest first: this year back to 1900, `dobRule`'s floor. */
export function yearOptions(todayIso: string): number[] {
  const current = Number(todayIso.slice(0, 4));
  return Array.from({ length: current - 1900 + 1 }, (_, i) => current - i);
}

/**
 * Where the picker opens when the field is empty: January, thirty years ago,
 * so most applicants are one or two clicks from their year rather than
 * scrolling back from this month.
 */
export function defaultView(todayIso: string): { year: number; month: number } {
  return { year: Number(todayIso.slice(0, 4)) - 30, month: 0 };
}
