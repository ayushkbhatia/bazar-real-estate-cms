import { describe, expect, it } from "vitest";
import {
  DUBAI_TIME_ZONE,
  DUBAI_UTC_OFFSET_MINUTES,
  dubaiDateKey,
  dubaiDayStart,
  dubaiInstant,
  dubaiParts,
  dubaiWeekday,
} from "./dubai-time";

/** What Intl says the UTC offset of Asia/Dubai is at `at`, in minutes. */
function intlOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DUBAI_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

describe("Dubai time", () => {
  it("has the fixed +04:00 offset the module assumes, all year, for the years this module will run", () => {
    for (let year = 2026; year <= 2030; year++) {
      for (let month = 0; month < 12; month++) {
        const at = new Date(Date.UTC(year, month, 15, 12));
        expect(intlOffsetMinutes(at), `${year}-${month + 1}`).toBe(DUBAI_UTC_OFFSET_MINUTES);
      }
    }
  });

  it("reads a UTC instant as Dubai wall-clock time", () => {
    // 22 Sep 2026 06:14 UTC is 10:14 in Dubai, a Tuesday.
    expect(dubaiParts(new Date("2026-09-22T06:14:00Z"))).toEqual({
      year: 2026,
      month: 9,
      day: 22,
      weekday: 2,
      minutes: 10 * 60 + 14,
    });
  });

  it("puts the late-evening UTC hours on the next Dubai day", () => {
    // 21:30 UTC on 30 Sep is 01:30 on 1 Oct in Dubai.
    const p = dubaiParts(new Date("2026-09-30T21:30:00Z"));
    expect([p.month, p.day, p.minutes]).toEqual([10, 1, 90]);
  });

  it("round-trips a wall-clock time through dubaiInstant", () => {
    const at = dubaiInstant(2026, 9, 22, 10, 14);
    expect(at.toISOString()).toBe("2026-09-22T06:14:00.000Z");
    expect(dubaiParts(at).minutes).toBe(614);
  });

  it("finds the local midnight, weekday and date key of any instant in the day", () => {
    const midnight = dubaiDayStart(new Date("2026-09-22T19:59:00Z").getTime());
    expect(new Date(midnight).toISOString()).toBe("2026-09-21T20:00:00.000Z");
    expect(dubaiWeekday(midnight)).toBe(2);
    expect(dubaiDateKey(midnight)).toBe("2026-09-22");
    // One minute later it is Wednesday in Dubai.
    const next = dubaiDayStart(new Date("2026-09-22T20:00:00Z").getTime());
    expect(dubaiDateKey(next)).toBe("2026-09-23");
  });
});
