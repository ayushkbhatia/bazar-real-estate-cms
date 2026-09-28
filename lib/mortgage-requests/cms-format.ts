/**
 * How the team's CMS prints what it knows (docs/mortgage/cms/00-foundations
 * §9). Asia/Dubai throughout; English only (the CMS always is). Built on
 * format.ts, which prints "Sep" rather than ICU's "Sept".
 */

import { DAY_MS, dubaiDateKey, dubaiDayStart, dubaiParts } from "./dubai-time";
import { formatDayTime, formatTime } from "./format";

const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function daysAgo(at: Date, now: Date): number {
  return Math.round((dubaiDayStart(now.getTime()) - dubaiDayStart(at.getTime())) / DAY_MS);
}

/** "18 Sep". */
export function formatDayMonth(value: string | Date): string {
  const p = dubaiParts(new Date(value));
  return `${p.day} ${EN_MONTHS[p.month - 1]}`;
}

/** "Wed 23 Sep" — C6's day chips. */
export function formatWeekdayDate(value: string | Date): string {
  const p = dubaiParts(new Date(value));
  return `${EN_WEEKDAYS[p.weekday]} ${p.day} ${EN_MONTHS[p.month - 1]}`;
}

/**
 * C1's Received column: "Today 10:14" (the caller wraps it in the copy's
 * "Today {time}"), "Mon 18:20" within the week, and "18 Sep" before that.
 */
export function receivedParts(value: string | Date, now: Date): { kind: "today"; time: string } | { kind: "other"; text: string } {
  const at = new Date(value);
  const ago = daysAgo(at, now);
  if (ago <= 0) return { kind: "today", time: formatTime(at) };
  const p = dubaiParts(at);
  if (ago < 7) return { kind: "other", text: `${EN_WEEKDAYS[p.weekday]} ${formatTime(at)}` };
  return { kind: "other", text: formatDayMonth(at) };
}

/** An activity line's time: "16:21" today, "Mon 18:20" this week, "18 Sep" before. */
export function formatActivityTime(value: string | Date, now: Date): string {
  const parts = receivedParts(value, now);
  return parts.kind === "today" ? parts.time : parts.text;
}

/** C6's header: "today 09:47", "yesterday 18:20", "Mon 18:20", "18 Sep". */
export function formatWhen(value: string | Date, now: Date): string {
  const at = new Date(value);
  const ago = daysAgo(at, now);
  if (ago <= 0) return `today ${formatTime(at)}`;
  if (ago === 1) return `yesterday ${formatTime(at)}`;
  if (ago < 7) return `${EN_WEEKDAYS[dubaiParts(at).weekday]} ${formatTime(at)}`;
  return formatDayMonth(at);
}

/** "1990-03-14" → "14 Mar 1990". */
export function formatLongDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${EN_MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Whole years between a date of birth and today in Dubai. */
export function ageOn(isoDate: string, now: Date): number {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const today = dubaiDateKey(dubaiDayStart(now.getTime()));
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** "94.203.12.7" → "94.203.•.•"; an IPv6 address keeps its first two groups. */
export function maskIp(ip: string | null): string {
  if (!ip) return "—";
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (v4) return `${v4[1]}.${v4[2]}.•.•`;
  const groups = ip.split(":").filter(Boolean);
  return groups.length >= 2 ? `${groups[0]}:${groups[1]}:•` : "•";
}

/** The browser and the system a user agent names, as C2's consent line shows them. */
export function describeUserAgent(ua: string | null): { browser: string; os: string } {
  const s = ua ?? "";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\//.test(s)
      ? "Opera"
      : /Firefox\//.test(s)
        ? "Firefox"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : "Unknown browser";
  const os = /iPhone|iPad/.test(s)
    ? "iOS"
    : /Android/.test(s)
      ? "Android"
      : /Mac OS X|Macintosh/.test(s)
        ? "macOS"
        : /Windows/.test(s)
          ? "Windows"
          : /Linux/.test(s)
            ? "Linux"
            : "unknown system";
  return { browser, os };
}

/** "412 KB", "1.5 MB" (binary units, as the website prints them). */
export function formatBytes(bytes: number): string {
  if (bytes < 1_048_576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** "0:32", "4:05" — a call's length. */
export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "Yasmin Abdalla" → "YA". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0], parts[0]?.[1]];
  return letters.filter(Boolean).join("").toUpperCase();
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "+971502184417" → "+971 50 ••• 4417" (C1 masks every mobile). */
export { maskMobile, formatMobile, formatDayTime, formatTime } from "./format";

/** "Wed 23 Sep · 11:30" — a booked consultation in C1's promise column. */
export function formatBookedAt(value: string | Date): string {
  return `${formatWeekdayDate(value)} · ${formatTime(value)}`;
}

/** "Wed 23 Sep, 10:00" — the Book button's slot. */
export function formatSlot(value: string | Date): string {
  return formatDayTime(value);
}
