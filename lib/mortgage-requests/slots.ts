/**
 * An adviser's free consultation slots (C6 "Book the consultation"): their
 * working hours for the day — their own, where set, else the team's — minus
 * public holidays and consultations already booked, on a 30-minute grid, each
 * slot as long as a consultation (20 minutes by default). No calendar sync in
 * v1 (SPEC scope). Asia/Dubai, like every time in the module.
 */

import { DAY_MS, dubaiDateKey, dubaiDayStart, dubaiInstant, dubaiWeekday, MINUTE_MS } from "./dubai-time";
import type { WorkingHoursSetting } from "./sla";

export type Window = { start: number; end: number };

/** "09:30" → 570. */
function minutesOf(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** One weekday's windows from the settings' `working_hours` shape. */
export function windowsFromSetting(setting: WorkingHoursSetting, weekday: number): Window[] {
  return (setting[String(weekday)] ?? []).map(([a, b]) => ({ start: minutesOf(a), end: minutesOf(b) }));
}

/** One adviser's windows from `mortgage_adviser_hours` rows, or null when they have none. */
export function windowsFromAdviserHours(
  rows: readonly { weekday: number; starts: string; ends: string }[],
  weekday: number,
): Window[] | null {
  if (rows.length === 0) return null;
  return rows
    .filter((r) => r.weekday === weekday)
    .map((r) => ({ start: minutesOf(r.starts), end: minutesOf(r.ends) }));
}

export type Slot = { time: string; startsAt: string; available: boolean };

/** The day's slots, taken ones marked unavailable, past ones dropped. */
export function slotsForDay(input: {
  /** "YYYY-MM-DD" in Dubai. */
  day: string;
  windows: readonly Window[];
  holidays: ReadonlySet<string>;
  /** The adviser's booked consultations. */
  bookings: readonly { startsAt: string; endsAt: string }[];
  gridMinutes: number;
  durationMinutes: number;
  now: Date;
}): Slot[] {
  if (input.holidays.has(input.day)) return [];
  const [y, m, d] = input.day.split("-").map(Number) as [number, number, number];
  const busy = input.bookings.map((b) => ({ start: new Date(b.startsAt).getTime(), end: new Date(b.endsAt).getTime() }));
  const slots: Slot[] = [];
  for (const w of [...input.windows].sort((a, b) => a.start - b.start)) {
    for (let t = w.start; t + input.durationMinutes <= w.end; t += input.gridMinutes) {
      const starts = dubaiInstant(y, m, d, Math.floor(t / 60), t % 60).getTime();
      if (starts <= input.now.getTime()) continue;
      const ends = starts + input.durationMinutes * MINUTE_MS;
      const clash = busy.some((b) => starts < b.end && b.start < ends);
      slots.push({
        time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
        startsAt: new Date(starts).toISOString(),
        available: !clash,
      });
    }
  }
  return slots;
}

/**
 * The next `count` days on which the team works, starting tomorrow (C6's
 * "Day" chips, proposal: the next four working days).
 */
export function nextWorkingDays(input: {
  from: Date;
  count: number;
  setting: WorkingHoursSetting;
  holidays: ReadonlySet<string>;
}): string[] {
  const days: string[] = [];
  let start = dubaiDayStart(input.from.getTime()) + DAY_MS;
  for (let i = 0; days.length < input.count && i < 60; i++, start += DAY_MS) {
    const key = dubaiDateKey(start);
    if (input.holidays.has(key)) continue;
    if (windowsFromSetting(input.setting, dubaiWeekday(start)).length === 0) continue;
    days.push(key);
  }
  return days;
}
