import { describe, expect, it } from "vitest";
import { dubaiInstant } from "./dubai-time";
import {
  ALWAYS_OPEN,
  DEFAULT_WORKING_HOURS,
  addWorkingSeconds,
  calendarFromSettings,
  clockDueFrom,
  clockPause,
  clockResume,
  formatDuration,
  slaPolicy,
  slaStatus,
  subtractWorkingSeconds,
  workingSecondsBetween,
  type SlaFields,
  type SlaPolicy,
} from "./sla";

// September 2026: Sun 20, Mon 21, Tue 22, Wed 23, Thu 24, Fri 25, Sat 26, Sun 27, Mon 28, Tue 29.
const at = (day: number, hour: number, minute = 0, month = 9) =>
  dubaiInstant(2026, month, day, hour, minute);
const H = 3600;
const M = 60;

const OFFICE = calendarFromSettings(DEFAULT_WORKING_HOURS);
const office: SlaPolicy = { budgetSeconds: 24 * H, riskSeconds: 4 * H, calendar: OFFICE };
const wallClock: SlaPolicy = { budgetSeconds: 24 * H, riskSeconds: 4 * H, calendar: ALWAYS_OPEN };

const running = (startedAt: Date, dueAt: Date): SlaFields => ({
  sla_started_at: startedAt.toISOString(),
  sla_due_at: dueAt.toISOString(),
  sla_paused_at: null,
  sla_remaining_seconds: null,
  sla_stopped_at: null,
});

describe("the working calendar", () => {
  it("defaults to Bazar's published office hours: Sun–Thu 09:00–19:00, Fri 09:00–15:00, Sat closed", () => {
    expect(OFFICE.week[0]).toEqual([{ start: 540, end: 1140 }]);
    expect(OFFICE.week[4]).toEqual([{ start: 540, end: 1140 }]);
    expect(OFFICE.week[5]).toEqual([{ start: 540, end: 900 }]);
    expect(OFFICE.week[6]).toEqual([]);
  });

  it("merges overlapping windows so no minute counts twice", () => {
    const cal = calendarFromSettings({ "1": [["13:00", "17:00"], ["09:00", "14:00"]] });
    expect(cal.week[1]).toEqual([{ start: 540, end: 1020 }]);
    expect(cal.week[0]).toEqual([]);
  });

  it("refuses times that aren't HH:MM times of day, and windows that end before they start", () => {
    expect(() => calendarFromSettings({ "1": [["9:00", "17:00"]] })).toThrow("isn't HH:MM");
    expect(() => calendarFromSettings({ "1": [["09:00", "24:30"]] })).toThrow("isn't a time of day");
    expect(() => calendarFromSettings({ "1": [["17:00", "09:00"]] })).toThrow("ends before it starts");
    expect(calendarFromSettings({ "1": [["00:00", "24:00"]] }).week[1]).toEqual([{ start: 0, end: 1440 }]);
  });

  it("builds the policy from the settings row", () => {
    const policy = slaPolicy(
      { sla_budget_minutes: 1440, sla_risk_minutes: 240, working_hours: DEFAULT_WORKING_HOURS },
      ["2026-12-02"],
    );
    expect(policy.budgetSeconds).toBe(24 * H);
    expect(policy.riskSeconds).toBe(4 * H);
    expect(policy.calendar.holidays.has("2026-12-02")).toBe(true);
  });
});

describe("working time", () => {
  it("counts only the time inside working windows", () => {
    expect(workingSecondsBetween(at(22, 10, 14), at(22, 16, 32), OFFICE)).toBe(6 * H + 18 * M);
    // An evening and a night: 18:00–19:00 Tuesday, 09:00–10:00 Wednesday.
    expect(workingSecondsBetween(at(22, 18), at(23, 10), OFFICE)).toBe(2 * H);
    // Friday's short day and the closed Saturday.
    expect(workingSecondsBetween(at(25, 14), at(27, 10), OFFICE)).toBe(2 * H);
  });

  it("is negative backwards", () => {
    expect(workingSecondsBetween(at(23, 10), at(22, 18), OFFICE)).toBe(-2 * H);
  });

  it("adds a 24-hour budget across evenings: Tue 10:14 falls due Thu 14:14", () => {
    // Tue 8h46m, Wed 10h, then 5h14m of Thursday.
    expect(addWorkingSeconds(at(22, 10, 14), 24 * H, OFFICE)).toEqual(at(24, 14, 14));
  });

  it("skips the weekend: Fri 14:00 falls due Tue 12:00", () => {
    // Fri 1h, Sat closed, Sun 10h, Mon 10h, then 3h of Tuesday.
    expect(addWorkingSeconds(at(25, 14), 24 * H, OFFICE)).toEqual(at(29, 12));
  });

  it("starts counting at the next opening when submitted out of hours", () => {
    expect(addWorkingSeconds(at(26, 11), 24 * H, OFFICE)).toEqual(at(29, 13)); // Saturday
    expect(addWorkingSeconds(at(22, 20), 24 * H, OFFICE)).toEqual(at(25, 13)); // Tuesday night
  });

  it("can fall due exactly at closing time", () => {
    expect(addWorkingSeconds(at(25, 9), 6 * H, OFFICE)).toEqual(at(25, 15));
  });

  it("skips holidays", () => {
    const withHoliday = calendarFromSettings(DEFAULT_WORKING_HOURS, ["2026-09-23"]);
    expect(addWorkingSeconds(at(22, 10, 14), 24 * H, withHoliday)).toEqual(at(25, 14, 14));
  });

  it("subtracts as the inverse of adding", () => {
    for (const start of [at(22, 10, 14), at(25, 14), at(27, 9), at(28, 18, 59)]) {
      const due = addWorkingSeconds(start, 24 * H, OFFICE);
      expect(subtractWorkingSeconds(due, 24 * H, OFFICE)).toEqual(start);
    }
  });

  it("gives SPEC's original wall-clock promise with ALWAYS_OPEN", () => {
    expect(addWorkingSeconds(at(22, 10, 14), 24 * H, ALWAYS_OPEN)).toEqual(at(23, 10, 14));
    expect(clockDueFrom(at(22, 10, 14), wallClock)).toBe(at(23, 10, 14).toISOString());
  });

  it("refuses to search forever when the calendar has no working time", () => {
    const closed = calendarFromSettings({});
    expect(() => addWorkingSeconds(at(22, 9), H, closed)).toThrow("no working hours");
  });
});

describe("slaStatus", () => {
  it("reproduces every clock in C1 under the designs' wall-clock rule", () => {
    // Design "now": Tue 22 Sep 2026, 16:32. Received times from reference/mreq-cms-1.jsx.
    const now = at(22, 16, 32);
    const rows: [string, Date, string, string][] = [
      ["BZM-26-0406 Mariam Al Kaabi", at(21, 18, 20), "1h 48m", "at_risk"],
      ["BZM-26-0403 Thomas Becker", at(21, 19, 52), "3h 20m", "at_risk"],
      ["BZM-26-0398 Arjun Mehta", at(21, 21, 2), "4h 30m", "running"],
      ["BZM-26-0404 Liam Walsh", at(22, 1, 47), "9h 15m", "running"],
      ["BZM-26-0412 Priya Raman", at(22, 10, 14), "17h 42m", "running"],
      ["BZM-26-0416 Daniel Okafor", at(22, 13, 37), "21h 05m", "running"],
      ["BZM-26-0417 Sofia Marques", at(22, 15, 13), "22h 41m", "running"],
    ];
    for (const [who, received, left, state] of rows) {
      const status = slaStatus(running(received, addWorkingSeconds(received, 24 * H, ALWAYS_OPEN)), now, wallClock);
      expect(formatDuration(status.remainingSeconds!), who).toBe(left);
      expect(status.state, who).toBe(state);
    }
  });

  it("matches C2's bar: Priya is 26% through her 24 hours", () => {
    const status = slaStatus(running(at(22, 10, 14), at(23, 10, 14)), at(22, 16, 32), wallClock);
    expect(Math.round(status.pct!)).toBe(26);
    expect(status.dueAt).toBe(at(23, 10, 14).toISOString());
  });

  it("is at risk with 4 hours or less left, and running above that", () => {
    const due = at(24, 14, 14);
    const req = running(at(22, 10, 14), due);
    expect(slaStatus(req, subtractWorkingSeconds(due, 4 * H, OFFICE), office).state).toBe("at_risk");
    expect(slaStatus(req, subtractWorkingSeconds(due, 4 * H + M, OFFICE), office).state).toBe("running");
    expect(slaStatus(req, due, office)).toMatchObject({ state: "at_risk", remainingSeconds: 0 });
  });

  it("is breached once past due, even out of hours with no working time since", () => {
    const req = running(at(25, 9), at(25, 15)); // due Friday at closing
    expect(slaStatus(req, at(25, 16), office)).toMatchObject({ state: "breached", remainingSeconds: 0 });
    expect(slaStatus(req, at(27, 10), office)).toMatchObject({ state: "breached", remainingSeconds: -H });
    expect(slaStatus(req, at(27, 10), office).pct).toBe(100);
  });

  it("freezes while paused (C1: Karim, 'Paused · 9h 13m left')", () => {
    const status = slaStatus(
      {
        sla_started_at: at(21, 21, 5).toISOString(),
        sla_due_at: null,
        sla_paused_at: at(22, 11, 52).toISOString(),
        sla_remaining_seconds: 9 * H + 13 * M,
        sla_stopped_at: null,
      },
      at(28, 12),
      office,
    );
    expect(status).toMatchObject({ state: "paused", remainingSeconds: 9 * H + 13 * M, dueAt: null });
    expect(formatDuration(status.remainingSeconds!)).toBe("9h 13m");
  });

  it("gives back the time remaining at the pause when the clock resumes, and excludes the pause", () => {
    const start = at(22, 10, 14);
    const req = running(start, addWorkingSeconds(start, 24 * H, OFFICE));

    // Paused Wed 11:00: Wed 8h + Thu 5h14m still to go.
    const pausedAt = at(23, 11);
    const { remaining_seconds } = clockPause(req, pausedAt, office);
    expect(remaining_seconds).toBe(13 * H + 14 * M);

    // Resumed the next Monday afternoon.
    const resumedAt = at(28, 16);
    const { due_at } = clockResume({ sla_remaining_seconds: remaining_seconds }, resumedAt, office);
    expect(due_at).toBe(at(30, 9, 14).toISOString());

    const after = slaStatus({ ...req, sla_due_at: due_at }, resumedAt, office);
    expect(after.remainingSeconds).toBe(remaining_seconds);
    // Only working time before the pause has been used.
    expect(after.elapsedSeconds).toBe(workingSecondsBetween(start, pausedAt, OFFICE));
  });

  it("stops: met before the due time, breached after, and keeps the elapsed time C5 shows", () => {
    const req = running(at(22, 10, 14), at(24, 14, 14));
    const met = slaStatus({ ...req, sla_stopped_at: at(23, 9, 41).toISOString() }, at(28, 9), office);
    expect(met).toMatchObject({ state: "met", stopped: true });
    // Tue 10:14–19:00 plus 41 minutes on Wednesday.
    expect(formatDuration(met.elapsedSeconds!)).toBe("9h 27m");

    const late = slaStatus({ ...req, sla_stopped_at: at(24, 15).toISOString() }, at(28, 9), office);
    expect(late).toMatchObject({ state: "breached", stopped: true });
    expect(late.remainingSeconds).toBe(-46 * M);
  });

  it("has no clock for consultancy", () => {
    const none = slaStatus(
      { sla_started_at: null, sla_due_at: null, sla_paused_at: null, sla_remaining_seconds: null, sla_stopped_at: null },
      at(22, 12),
      office,
    );
    expect(none).toEqual({
      state: "none",
      stopped: false,
      remainingSeconds: null,
      elapsedSeconds: null,
      dueAt: null,
      pct: null,
    });
  });

  it("stays breached through a pause and resume that happen after the due time", () => {
    const req = running(at(22, 10, 14), at(24, 14, 14));
    const { remaining_seconds } = clockPause(req, at(24, 16), office); // 1h 46m overdue
    expect(remaining_seconds).toBe(-(H + 46 * M));
    const { due_at } = clockResume({ sla_remaining_seconds: remaining_seconds }, at(28, 10), office);
    const after = slaStatus({ ...req, sla_due_at: due_at }, at(28, 10), office);
    expect(after).toMatchObject({ state: "breached", remainingSeconds: -(H + 46 * M) });
  });

  it("keeps a promise already made when the working hours change", () => {
    // Due Thursday 14:14 under the office calendar; then the office opens on Saturdays.
    const req = running(at(22, 10, 14), at(24, 14, 14));
    const saturdays = calendarFromSettings({ ...DEFAULT_WORKING_HOURS, "6": [["09:00", "19:00"]] });
    const status = slaStatus(req, at(23, 9), { ...office, calendar: saturdays });
    expect(status.dueAt).toBe(at(24, 14, 14).toISOString());
  });

  it("won't pause a clock that isn't running, or resume one that isn't paused", () => {
    expect(() => clockPause({ sla_due_at: null }, at(22, 12), office)).toThrow("isn't running");
    expect(() => clockResume({ sla_remaining_seconds: null }, at(22, 12), office)).toThrow("isn't paused");
  });
});

describe("formatDuration", () => {
  it.each([
    [17 * H + 42 * M, "17h 42m"],
    [H + 48 * M, "1h 48m"],
    [21 * H + 5 * M, "21h 05m"],
    [9 * H + 13 * M, "9h 13m"],
    [12 * M, "12m"],
    [59, "0m"],
    [-(46 * M + 59), "46m"],
  ])("%i seconds reads %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
