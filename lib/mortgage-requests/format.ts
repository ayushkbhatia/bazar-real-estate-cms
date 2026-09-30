/**
 * How the mortgage module prints times, dates, mobiles, sizes and statement
 * months (docs/mortgage/frontend/00-foundations §9). Every time is shown in
 * Asia/Dubai. Nothing here computes a deadline: `dueAt` always comes from the
 * server, which gets it from sla.ts.
 *
 * English is assembled from fixed names rather than Intl, on purpose. ICU 72
 * changed en-GB's short September to "Sept", so `Intl.DateTimeFormat("en-GB")`
 * prints "Wed 23 Sept, 10:14" on current Node and browsers while the designs
 * (and the emails built from the same function) say "Wed 23 Sep, 10:14".
 * Arabic goes through Intl, where there is no house style to hold to yet.
 */

import { localeDateTag } from "@/lib/i18n/dates";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { MB } from "./documents";
import { DUBAI_TIME_ZONE, dubaiParts } from "./dubai-time";

const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
const EN_MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const two = (n: number) => String(n).padStart(2, "0");

function instant(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "Tue 22 Sep, 09:47" — W4's received time, W7's due time, the emails. */
export function formatDayTime(value: string | Date, locale: Locale = DEFAULT_LOCALE): string {
  const at = instant(value);
  if (locale !== "en") {
    return new Intl.DateTimeFormat(localeDateTag(locale), {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: DUBAI_TIME_ZONE,
    }).format(at);
  }
  const p = dubaiParts(at);
  return `${EN_WEEKDAYS[p.weekday]} ${p.day} ${EN_MONTHS[p.month - 1]}, ${two(Math.floor(p.minutes / 60))}:${two(p.minutes % 60)}`;
}

/** "09:47" — the track's "Received 09:47". The same digits in both locales. */
export function formatTime(value: string | Date): string {
  const p = dubaiParts(instant(value));
  return `${two(Math.floor(p.minutes / 60))}:${two(p.minutes % 60)}`;
}

/** "1990-03-14" → "14 / 03 / 1990", as W3 shows a date of birth. */
export function formatDob(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return m ? `${m[3]} / ${m[2]} / ${m[1]}` : isoDate;
}

/** "+971502184417" → "+971 50 218 4417". Anything else comes back unchanged. */
export function formatMobile(e164: string): string {
  const m = /^\+971(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+971 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** "+971502184417" → "+971 50 ••• 4417": W7's WhatsApp note, and every list that isn't the file itself. */
export function maskMobile(e164: string): string {
  const m = /^\+971(\d{2})\d{3}(\d{4})$/.exec(e164);
  return m ? `+971 ${m[1]} ••• ${m[2]}` : e164;
}

/** Bytes in MB (1 MB = 1,048,576 bytes) to one decimal: "14.8", "2.0". */
export function formatMb(bytes: number): string {
  return (bytes / MB).toFixed(1);
}

/** A limit in MB: whole limits stay whole ("10", "40"), as every design writes them. */
export function formatLimitMb(bytes: number): string {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

function parseMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-");
  return { year: Number(y), month: Number(m) };
}

function monthName(month: number, locale: Locale, width: "short" | "long"): string {
  if (locale === "en") return (width === "short" ? EN_MONTHS : EN_MONTHS_LONG)[month - 1]!;
  return new Intl.DateTimeFormat(localeDateTag(locale), {
    month: width,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, month - 1, 15)));
}

/** "2025-09" → "Sep 2025". */
export function formatMonthYear(ym: string, locale: Locale = DEFAULT_LOCALE): string {
  const { year, month } = parseMonth(ym);
  return `${monthName(month, locale, "short")} ${year}`;
}

/**
 * A list of months with each year written once, after its last month:
 * "Jun, Jul and Aug 2026", or across a year end "Nov, Dec 2025 and Jan 2026"
 * (the proposal in 00-foundations §9; not designed). `Intl.ListFormat` owns
 * the "and", so another language gets its own conjunction.
 */
export function formatMonthList(
  months: readonly string[],
  locale: Locale = DEFAULT_LOCALE,
  width: "short" | "long" = "short",
): string {
  const parsed = months.map(parseMonth);
  const items = parsed.map((p, i) => {
    const name = monthName(p.month, locale, width);
    const lastOfYear = i === parsed.length - 1 || parsed[i + 1]!.year !== p.year;
    return lastOfYear ? `${name} ${p.year}` : name;
  });
  return new Intl.ListFormat(localeDateTag(locale), { type: "conjunction" }).format(items);
}

/** A PostHog-safe bucket for a file size, never the size itself. */
export function sizeBucket(bytes: number): "<1MB" | "1-5MB" | "5-10MB" | "10-25MB" | ">25MB" {
  if (bytes < MB) return "<1MB";
  if (bytes < 5 * MB) return "1-5MB";
  if (bytes < 10 * MB) return "5-10MB";
  if (bytes < 25 * MB) return "10-25MB";
  return ">25MB";
}
