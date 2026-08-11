import { describe, expect, it } from "vitest";
import {
  dayIndex,
  dubaiNow,
  formatMinutes,
  parseMinutes,
  rotateToToday,
  statusFor,
  toRowView,
  type HoursRow,
} from "./hours";

const WEEK: HoursRow[] = [
  { day: "Monday", open: "09:00", close: "19:00", openDay: true },
  { day: "Tuesday", open: "09:00", close: "19:00", openDay: true },
  { day: "Wednesday", open: "09:00", close: "19:00", openDay: true },
  { day: "Thursday", open: "09:00", close: "19:00", openDay: true },
  { day: "Friday", open: "09:00", close: "19:00", openDay: true },
  { day: "Saturday", open: "09:00", close: "19:00", openDay: true },
  { day: "Sunday", open: null, close: null, openDay: false },
];

const views = () => WEEK.map(toRowView);

describe("parseMinutes", () => {
  it("reads 24-hour times", () => {
    expect(parseMinutes("09:00")).toBe(540);
    expect(parseMinutes("9:30")).toBe(570);
    expect(parseMinutes("00:00")).toBe(0);
    expect(parseMinutes("23:59")).toBe(1439);
  });

  it("refuses anything that isn't one, rather than guessing", () => {
    for (const bad of [null, "", "By appointment", "9am", "24:00", "12:60"]) {
      expect(parseMinutes(bad), `${bad}`).toBeNull();
    }
  });
});

describe("formatMinutes", () => {
  it("renders a 12-hour clock, dropping :00", () => {
    expect(formatMinutes(540)).toBe("9 AM");
    expect(formatMinutes(1170)).toBe("7:30 PM");
    expect(formatMinutes(0)).toBe("12 AM");
    expect(formatMinutes(720)).toBe("12 PM");
  });
});

describe("dayIndex", () => {
  it("matches on the first three letters, in any case", () => {
    expect(dayIndex("Sunday")).toBe(0);
    expect(dayIndex("mon")).toBe(1);
    expect(dayIndex("Saturdays")).toBe(6);
  });

  it("returns null for a name that isn't a weekday", () => {
    expect(dayIndex("Public holidays")).toBeNull();
  });
});

describe("toRowView", () => {
  it("renders a range from the two times", () => {
    expect(toRowView(WEEK[0]).display).toBe("9 AM–7 PM");
  });

  it("says Closed for a day that's switched off", () => {
    const row = toRowView(WEEK[6]);
    expect(row.display).toBe("Closed");
    expect(row.openMinutes).toBeNull();
  });

  it("keeps free text verbatim and out of the calculation", () => {
    const row = toRowView({
      day: "Friday",
      open: "By appointment",
      close: null,
      openDay: true,
    });
    expect(row.display).toBe("By appointment");
    expect(row.openMinutes).toBeNull();
  });

  it("leaves an overnight range alone instead of guessing at it", () => {
    const row = toRowView({
      day: "Friday",
      open: "22:00",
      close: "02:00",
      openDay: true,
    });
    expect(row.display).toBe("10 PM–2 AM");
    expect(row.openMinutes).toBeNull();
  });
});

describe("statusFor", () => {
  it("is open during the day, and names the closing time", () => {
    expect(statusFor(views(), { day: 1, minutes: 10 * 60 })).toEqual({
      open: true,
      state: "Open",
      detail: "Closes 7 PM",
    });
  });

  it("is closed before opening, and names today's opening time", () => {
    expect(statusFor(views(), { day: 1, minutes: 8 * 60 })).toEqual({
      open: false,
      state: "Closed",
      detail: "Opens 9 AM",
    });
  });

  it("points at tomorrow once the office has shut", () => {
    expect(statusFor(views(), { day: 1, minutes: 20 * 60 })).toEqual({
      open: false,
      state: "Closed",
      detail: "Opens tomorrow 9 AM",
    });
  });

  it("skips the closed day when looking for the next opening", () => {
    // Saturday evening — Sunday is shut, so the next opening is Monday.
    expect(statusFor(views(), { day: 6, minutes: 20 * 60 })).toEqual({
      open: false,
      state: "Closed",
      detail: "Opens Mon 9 AM",
    });
  });

  it("says closed without a time when no row carries usable hours", () => {
    const rows = [
      { day: "Monday", open: "By appointment", close: null, openDay: true },
    ].map(toRowView);
    expect(statusFor(rows, { day: 1, minutes: 600 })).toEqual({
      open: false,
      state: "Closed",
      detail: null,
    });
  });

  it("returns null when no row names a weekday at all", () => {
    const rows = [
      { day: "Whenever", open: "09:00", close: "19:00", openDay: true },
    ].map(toRowView);
    expect(statusFor(rows, { day: 1, minutes: 600 })).toBeNull();
  });

  it("closes exactly on the closing minute", () => {
    const at = (minutes: number) => statusFor(views(), { day: 1, minutes });
    expect(at(19 * 60 - 1)?.open).toBe(true);
    expect(at(19 * 60)?.open).toBe(false);
    expect(at(9 * 60)?.open).toBe(true);
  });
});

describe("rotateToToday", () => {
  it("puts today first and wraps the rest of the week round", () => {
    const rotated = rotateToToday(views(), 4).map((r) => r.day);
    expect(rotated).toEqual([
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
    ]);
  });

  it("leaves the stored order alone before the clock is known", () => {
    expect(rotateToToday(views(), null).map((r) => r.day)).toEqual(
      WEEK.map((r) => r.day),
    );
  });

  it("parks a row that isn't a weekday at the end", () => {
    const rows = [
      ...WEEK,
      { day: "Public holidays", open: null, close: null, openDay: false },
    ].map(toRowView);
    const rotated = rotateToToday(rows, 3).map((r) => r.day);
    expect(rotated[0]).toBe("Wednesday");
    expect(rotated[rotated.length - 1]).toBe("Public holidays");
  });
});

describe("dubaiNow", () => {
  it("reads the office clock, not the reader's", () => {
    // 2026-08-11T22:30:00Z is Wednesday 02:30 in Abu Dhabi (UTC+4).
    expect(dubaiNow(new Date("2026-08-11T22:30:00Z"))).toEqual({
      day: 3,
      minutes: 150,
    });
  });

  it("reports midnight as 0, not 24", () => {
    // 20:00Z is exactly midnight in Abu Dhabi.
    expect(dubaiNow(new Date("2026-08-11T20:00:00Z"))).toEqual({
      day: 3,
      minutes: 0,
    });
  });
});
