import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysInMonth, defaultView, monthGrid, monthOf, yearOptions } from "./calendar";

describe("the date-of-birth picker's calendar", () => {
  it("lays a month out Monday first, padded to whole weeks", () => {
    // 1 March 1990 was a Thursday.
    const weeks = monthGrid(1990, 2, "2026-10-09");
    expect(weeks[0]!.slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0]![3]).toEqual({ iso: "1990-03-01", day: 1, disabled: false });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("knows leap years", () => {
    expect(daysInMonth(2000, 1)).toBe(29);
    expect(daysInMonth(1900, 1)).toBe(28);
    expect(daysInMonth(2024, 1)).toBe(29);
  });

  it("disables today and every later day, since a date of birth is in the past", () => {
    const days = monthGrid(2026, 9, "2026-10-09").flat().filter(Boolean);
    expect(days.find((d) => d!.iso === "2026-10-08")!.disabled).toBe(false);
    expect(days.find((d) => d!.iso === "2026-10-09")!.disabled).toBe(true);
    expect(days.find((d) => d!.iso === "2026-10-31")!.disabled).toBe(true);
  });

  it("moves by days and months for the keyboard, clamping the day to the month", () => {
    expect(addDays("1990-03-01", -1)).toBe("1990-02-28");
    expect(addDays("1990-12-31", 7)).toBe("1991-01-07");
    expect(addMonths("1990-03-31", -1)).toBe("1990-02-28");
    expect(addMonths("1990-12-15", 1)).toBe("1991-01-15");
  });

  it("offers this year back to 1900, newest first, and opens thirty years back", () => {
    const years = yearOptions("2026-10-09");
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(1900);
    expect(defaultView("2026-10-09")).toEqual({ year: 1996, month: 0 });
  });

  it("reads the month of an ISO date, and nothing else", () => {
    expect(monthOf("1990-03-14")).toEqual({ year: 1990, month: 2 });
    expect(monthOf("14 / 03 / 1990")).toBeNull();
    expect(monthOf(null)).toBeNull();
  });
});
