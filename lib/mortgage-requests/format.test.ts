import { describe, expect, it } from "vitest";
import { MB, requiredStatementMonths } from "./documents";
import {
  formatDayTime,
  formatDob,
  formatLimitMb,
  formatMb,
  formatMobile,
  formatMonthList,
  formatMonthYear,
  formatTime,
  maskMobile,
  sizeBucket,
} from "./format";

// The examples in docs/mortgage/frontend/00-foundations §9, in Dubai time.
describe("mortgage formatting", () => {
  it("prints day and time as the designs do, in Dubai time", () => {
    // 05:47Z is 09:47 in Dubai.
    expect(formatDayTime("2026-09-22T05:47:00Z")).toBe("Tue 22 Sep, 09:47");
    expect(formatDayTime("2026-09-23T06:14:00Z")).toBe("Wed 23 Sep, 10:14");
    // Late UTC evening is already the next day in Dubai.
    expect(formatDayTime("2026-09-22T21:05:00Z")).toBe("Wed 23 Sep, 01:05");
  });

  it('never prints ICU\'s "Sept"', () => {
    expect(formatDayTime(new Date("2026-09-01T08:00:00Z"))).not.toContain("Sept");
  });

  it("prints Arabic through Intl with Latin digits", () => {
    const ar = formatDayTime("2026-09-23T06:14:00Z", "ar");
    expect(ar).toContain("10:14");
    expect(ar).toMatch(/[؀-ۿ]/);
  });

  it("prints the time alone", () => {
    expect(formatTime("2026-09-22T05:47:00Z")).toBe("09:47");
  });

  it("prints a date of birth with spaced slashes", () => {
    expect(formatDob("1990-03-14")).toBe("14 / 03 / 1990");
    expect(formatDob("not a date")).toBe("not a date");
  });

  it("formats and masks a UAE mobile", () => {
    expect(formatMobile("+971502184417")).toBe("+971 50 218 4417");
    expect(maskMobile("+971502184417")).toBe("+971 50 ••• 4417");
    expect(formatMobile("+441234567890")).toBe("+441234567890");
  });

  it("prints sizes in binary MB to one decimal, and limits whole", () => {
    expect(formatMb(Math.round(14.8 * MB))).toBe("14.8");
    expect(formatMb(2 * MB)).toBe("2.0");
    expect(formatLimitMb(10 * MB)).toBe("10");
    expect(formatLimitMb(40 * MB)).toBe("40");
  });

  it("writes the three statement months as W5 does", () => {
    const months = requiredStatementMonths("bank_statements_3m", "2026-09-22T06:00:00Z");
    expect(formatMonthList(months)).toBe("Jun, Jul and Aug 2026");
  });

  it("writes a three-month window across a year end with both years", () => {
    const months = requiredStatementMonths("bank_statements_3m", "2026-02-10T06:00:00Z");
    expect(months).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(formatMonthList(months)).toBe("Nov, Dec 2025 and Jan 2026");
  });

  it("gives the ends of the twelve-month range as W6 writes them", () => {
    const months = requiredStatementMonths("bank_statements_12m", "2026-09-22T06:00:00Z");
    expect(formatMonthYear(months[0]!)).toBe("Sep 2025");
    expect(formatMonthYear(months.at(-1)!)).toBe("Aug 2026");
  });

  it("writes long month names for W8", () => {
    expect(formatMonthList(["2026-06", "2026-07", "2026-08"], "en", "long")).toBe(
      "June, July and August 2026",
    );
  });

  it("buckets sizes for analytics", () => {
    expect(sizeBucket(500_000)).toBe("<1MB");
    expect(sizeBucket(3 * MB)).toBe("1-5MB");
    expect(sizeBucket(30 * MB)).toBe(">25MB");
  });
});
