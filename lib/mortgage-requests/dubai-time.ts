/**
 * Asia/Dubai local time, without Intl.
 *
 * Every mortgage deadline and statement month is reckoned in Dubai time (SPEC
 * §2.5). The UAE has kept UTC+04:00 all year since 1970 and observes no
 * daylight saving, so a fixed offset is exact — and it lets the working-time
 * maths in sla.ts step through days with integer arithmetic instead of a
 * time-zone database. dubai-time.test.ts checks the offset against Intl, so a
 * change in the rule would fail loudly rather than skew every clock by an hour.
 */

export const DUBAI_TIME_ZONE = "Asia/Dubai";
export const DUBAI_UTC_OFFSET_MINUTES = 240;

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;
const OFFSET_MS = DUBAI_UTC_OFFSET_MINUTES * MINUTE_MS;

export type DubaiParts = {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** Minutes after local midnight, 0–1439 */
  minutes: number;
};

/** The Dubai calendar date and time of an instant. */
export function dubaiParts(at: Date): DubaiParts {
  const local = new Date(at.getTime() + OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** The instant of Dubai local midnight starting the day that contains `ms`. */
export function dubaiDayStart(ms: number): number {
  return Math.floor((ms + OFFSET_MS) / DAY_MS) * DAY_MS - OFFSET_MS;
}

/** Dubai weekday (0 = Sunday) of a Dubai midnight from `dubaiDayStart`. */
export function dubaiWeekday(dayStartMs: number): number {
  return new Date(dayStartMs + OFFSET_MS).getUTCDay();
}

/** "YYYY-MM-DD" of a Dubai midnight from `dubaiDayStart`. */
export function dubaiDateKey(dayStartMs: number): string {
  return new Date(dayStartMs + OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant for a Dubai wall-clock time. `month` is 1–12. */
export function dubaiInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - OFFSET_MS);
}
