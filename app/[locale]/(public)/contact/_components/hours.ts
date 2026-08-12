/**
 * Opening-hours model for /contact.
 *
 * The rows themselves are editor-owned (master page → Contact details →
 * Opening hours), so every value here arrives as free text and nothing may
 * throw on it. Times are read as 24-hour `HH:MM`; anything else — "By
 * appointment", a blank, a typo — still renders verbatim, it just drops out of
 * the open/closed calculation rather than producing a wrong answer.
 *
 * The office is in Abu Dhabi, so "now" is always Asia/Dubai (UTC+4, no DST)
 * regardless of where the reader is. The calculation runs on the client: the
 * page is statically revalidated and CDN-cached, so a server-rendered status
 * would be stale by up to the cache lifetime.
 */

export type HoursRow = {
  day: string;
  /** Raw editor text — "09:00", or free text like "By appointment". */
  open: string | null;
  close: string | null;
  /** False for a day the office is shut. */
  openDay: boolean;
};

export type HoursRowView = HoursRow & {
  /** 0 = Sunday … 6 = Saturday, matching `Date#getDay`. Null if unrecognised. */
  index: number | null;
  /** "9 AM–7 PM", "Closed", or the editor's own words. */
  display: string;
  openMinutes: number | null;
  closeMinutes: number | null;
};

export type HoursStatus = {
  open: boolean;
  /** "Open" / "Closed". */
  state: string;
  /** "Closes 7 PM", "Opens Mon 9 AM" — null when nothing can be said. */
  detail: string | null;
};

const DAY_PREFIXES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "09:00" → 540. Null for anything that isn't a 24-hour clock time. */
export function parseMinutes(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 540 → "9 AM", 1170 → "7:30 PM". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const suffix = hours < 12 ? "AM" : "PM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0
    ? `${h12} ${suffix}`
    : `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "Monday", "mon", "Mondays" → 1. Null when the name isn't a weekday. */
export function dayIndex(day: string): number | null {
  const key = day.trim().toLowerCase().slice(0, 3);
  const i = DAY_PREFIXES.indexOf(key);
  return i === -1 ? null : i;
}

/**
 * Resolve one stored row for rendering.
 *
 * A closing time at or before the opening time (an overnight shift) is left as
 * written and excluded from the status calculation — an office that says
 * "22:00–02:00" is rare enough that guessing at it is worse than saying
 * nothing.
 */
export function toRowView(row: HoursRow): HoursRowView {
  const openMinutes = parseMinutes(row.open);
  const closeMinutes = parseMinutes(row.close);
  const usable =
    row.openDay &&
    openMinutes !== null &&
    closeMinutes !== null &&
    closeMinutes > openMinutes;

  let display: string;
  if (!row.openDay) display = "Closed";
  else if (openMinutes !== null && closeMinutes !== null)
    display = `${formatMinutes(openMinutes)}–${formatMinutes(closeMinutes)}`;
  else display = [row.open, row.close].filter(Boolean).join("–") || "—";

  return {
    ...row,
    index: dayIndex(row.day),
    display,
    openMinutes: usable ? openMinutes : null,
    closeMinutes: usable ? closeMinutes : null,
  };
}

/** The current weekday and minute-of-day in Abu Dhabi. */
export function dubaiNow(date: Date = new Date()): {
  day: number;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  // `hour12: false` yields "24" for midnight on some ICU versions.
  const hour = Number(get("hour")) % 24;
  return {
    day: Math.max(0, dayIndex(get("weekday")) ?? 0),
    minutes: hour * 60 + Number(get("minute")),
  };
}

/**
 * Rows in the order they should read: today first, then the rest of the week.
 * A row whose day name isn't a weekday keeps its position at the end.
 */
export function rotateToToday(
  rows: HoursRowView[],
  today: number | null,
): HoursRowView[] {
  if (today === null) return rows;
  const known = rows.filter((r) => r.index !== null);
  const unknown = rows.filter((r) => r.index === null);
  const sorted = known
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const da = ((a.row.index as number) - today + 7) % 7;
      const db = ((b.row.index as number) - today + 7) % 7;
      return da === db ? a.i - b.i : da - db;
    })
    .map((entry) => entry.row);
  return [...sorted, ...unknown];
}

/**
 * The Google-style summary line: open now and when it closes, or shut and when
 * it next opens. Returns null when no row carries usable times.
 */
export function statusFor(
  rows: HoursRowView[],
  now: { day: number; minutes: number },
): HoursStatus | null {
  const byDay = new Map<number, HoursRowView>();
  for (const row of rows) {
    if (row.index !== null && !byDay.has(row.index)) byDay.set(row.index, row);
  }
  if (byDay.size === 0) return null;

  const today = byDay.get(now.day);
  if (
    today?.openMinutes != null &&
    today.closeMinutes != null &&
    now.minutes >= today.openMinutes &&
    now.minutes < today.closeMinutes
  ) {
    return {
      open: true,
      state: "Open",
      detail: `Closes ${formatMinutes(today.closeMinutes)}`,
    };
  }

  if (today?.openMinutes != null && now.minutes < today.openMinutes) {
    return {
      open: false,
      state: "Closed",
      detail: `Opens ${formatMinutes(today.openMinutes)}`,
    };
  }

  for (let step = 1; step <= 7; step++) {
    const next = byDay.get((now.day + step) % 7);
    if (next?.openMinutes == null) continue;
    const label = step === 1 ? "tomorrow" : DAY_SHORT[(now.day + step) % 7];
    return {
      open: false,
      state: "Closed",
      detail: `Opens ${label} ${formatMinutes(next.openMinutes)}`,
    };
  }

  // Every row is closed or unparseable — say so without inventing a time.
  return { open: false, state: "Closed", detail: null };
}
