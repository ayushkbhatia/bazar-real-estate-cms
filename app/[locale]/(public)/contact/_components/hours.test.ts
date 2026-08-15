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

  it("takes its meridiem labels from the caller", () => {
    // Arabic writes ص and م. The defaults keep every other caller — and the
    // rest of this file — on English.
    expect(formatMinutes(540, { am: "ص", pm: "م" })).toBe("9 ص");
    expect(formatMinutes(1170, { am: "ص", pm: "م" })).toBe("7:30 م");
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
    // The words are the caller's now: a usable range surfaces as two minute
    // counts and no text at all.
    const view = toRowView(WEEK[0]);
    expect(view.openMinutes).toBe(540);
    expect(view.closeMinutes).toBe(1140);
    expect(view.rawDisplay).toBeNull();
    expect(view.closedDay).toBe(false);
  });

  it("says Closed for a day that's switched off", () => {
    const row = toRowView(WEEK[6]);
    expect(row.closedDay).toBe(true);
    expect(row.rawDisplay).toBeNull();
    expect(row.openMinutes).toBeNull();
  });

  it("keeps free text verbatim and out of the calculation", () => {
    const row = toRowView({
      day: "Friday",
      open: "By appointment",
      close: null,
      openDay: true,
    });
    // Free text the editor typed survives verbatim — it is content, and its
    // Arabic comes from the master page's twin rather than the catalogue.
    expect(row.rawDisplay).toBe("By appointment");
    expect(row.openMinutes).toBeNull();
  });

  it("leaves an overnight range alone instead of guessing at it", () => {
    const row = toRowView({
      day: "Friday",
      open: "22:00",
      close: "02:00",
      openDay: true,
    });
    // An overnight shift stays as written and out of the calculation.
    expect(row.rawDisplay).toBe("22:00–02:00");
    expect(row.openMinutes).toBeNull();
    expect(row.openMinutes).toBeNull();
  });
});

describe("statusFor", () => {
  it("is open during the day, and names the closing time", () => {
    expect(statusFor(views(), { day: 1, minutes: 10 * 60 })).toEqual({
      open: true,
      kind: "closesAt",
      minutes: 19 * 60,
      day: null,
    });
  });

  it("is closed before opening, and names today's opening time", () => {
    expect(statusFor(views(), { day: 1, minutes: 8 * 60 })).toEqual({
      open: false,
      kind: "opensAt",
      minutes: 9 * 60,
      day: null,
    });
  });

  it("points at tomorrow once the office has shut", () => {
    expect(statusFor(views(), { day: 1, minutes: 20 * 60 })).toEqual({
      open: false,
      kind: "opensTomorrow",
      minutes: 9 * 60,
      day: null,
    });
  });

  it("skips the closed day when looking for the next opening", () => {
    // Saturday evening — Sunday is shut, so the next opening is Monday.
    expect(statusFor(views(), { day: 6, minutes: 20 * 60 })).toEqual({
      open: false,
      kind: "opensDay",
      minutes: 9 * 60,
      day: 1,
    });
  });

  it("says closed without a time when no row carries usable hours", () => {
    const rows = [
      { day: "Monday", open: "By appointment", close: null, openDay: true },
    ].map(toRowView);
    expect(statusFor(rows, { day: 1, minutes: 600 })).toEqual({
      open: false,
      kind: "none",
      minutes: null,
      day: null,
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
