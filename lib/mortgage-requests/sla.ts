/**
 * The 24-hour promise (docs/mortgage/SPEC.md §2.5): the only place deadline
 * maths happens. Pages, the queue's sort, the at-risk alerts and the database
 * functions all take their numbers from here; nothing computes a deadline on
 * its own.
 *
 * The clock runs on working hours (decision D11, 28 Sep 2026). A request has a
 * budget of working time (24 hours by default), measured against a weekly
 * calendar of working windows minus holidays, all in Dubai time. Nights,
 * closed days and holidays don't count. The calendar and budget come from
 * `mortgage_settings` and `mortgage_holidays`; `ALWAYS_OPEN` gives SPEC's
 * original wall-clock behaviour, which the designs were drawn with.
 *
 * What the database stores, and why this module is what fills it:
 *   · `sla_due_at` — fixed when the clock starts or resumes. It is the promise
 *     already shown to the applicant (W7), so later calendar edits don't move it.
 *   · `sla_remaining_seconds` — working time left, frozen while paused.
 *   · `sla_paused_at`, `sla_stopped_at` — when those happened.
 * `mortgage_transition()` takes `clockPause()` / `clockResume()` output as
 * its `p_sla` argument, and `mortgage_create_request()` takes `clockDueFrom()`.
 */

import {
  DAY_MS,
  MINUTE_MS,
  dubaiDateKey,
  dubaiDayStart,
  dubaiWeekday,
} from "./dubai-time";

/** Minutes after Dubai midnight; `end` is exclusive and may be 1440. */
export type WorkingWindow = { readonly start: number; readonly end: number };

export type WorkingCalendar = {
  /** Seven entries, 0 = Sunday … 6 = Saturday. */
  readonly week: readonly (readonly WorkingWindow[])[];
  /** Dubai dates ("YYYY-MM-DD") with no working time. */
  readonly holidays: ReadonlySet<string>;
};

/** `mortgage_settings.working_hours`: "0"–"6" → [["HH:MM", "HH:MM"], …]. */
export type WorkingHoursSetting = Readonly<Record<string, readonly (readonly [string, string])[]>>;

/**
 * Bazar's office hours as published on /contact on 28 Sep 2026, and the
 * default in migration 0138: Sunday to Thursday 09:00–19:00, Friday
 * 09:00–15:00, Saturday closed.
 */
export const DEFAULT_WORKING_HOURS: WorkingHoursSetting = {
  "0": [["09:00", "19:00"]],
  "1": [["09:00", "19:00"]],
  "2": [["09:00", "19:00"]],
  "3": [["09:00", "19:00"]],
  "4": [["09:00", "19:00"]],
  "5": [["09:00", "15:00"]],
  "6": [],
};

/** Every hour counts: SPEC's original wall-clock promise. */
export const ALWAYS_OPEN: WorkingCalendar = {
  week: Array.from({ length: 7 }, () => [{ start: 0, end: 1440 }]),
  holidays: new Set(),
};

function parseClock(value: unknown): number {
  const match = typeof value === "string" ? value.match(/^(\d{2}):(\d{2})$/) : null;
  if (!match) throw new Error(`working hours: "${String(value)}" isn't HH:MM`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) {
    throw new Error(`working hours: "${value}" isn't a time of day`);
  }
  return hours * 60 + minutes;
}

/** A calendar from `mortgage_settings.working_hours` and the holiday dates. */
export function calendarFromSettings(
  workingHours: unknown,
  holidays: Iterable<string> = [],
): WorkingCalendar {
  const setting = (workingHours ?? {}) as Record<string, unknown>;
  const week = Array.from({ length: 7 }, (_, day) => {
    const raw = setting[String(day)] ?? [];
    if (!Array.isArray(raw)) throw new Error(`working hours: day ${day} isn't a list`);
    const windows = raw
      .map((pair) => {
        if (!Array.isArray(pair) || pair.length !== 2) {
          throw new Error(`working hours: day ${day} has a window that isn't [start, end]`);
        }
        const window = { start: parseClock(pair[0]), end: parseClock(pair[1]) };
        if (window.end <= window.start) {
          throw new Error(`working hours: day ${day} has a window that ends before it starts`);
        }
        return window;
      })
      .sort((a, b) => a.start - b.start);
    // Merge overlapping or touching windows, so no minute is counted twice.
    const merged: WorkingWindow[] = [];
    for (const w of windows) {
      const last = merged.at(-1);
      if (last && w.start <= last.end) {
        merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, w.end) };
      } else {
        merged.push(w);
      }
    }
    return merged;
  });
  return { week, holidays: new Set(holidays) };
}

/** Never scan further than this for working time: a calendar with none would loop forever. */
const MAX_DAYS = 3660;

function windowsOn(dayStart: number, calendar: WorkingCalendar): [number, number][] {
  if (calendar.holidays.has(dubaiDateKey(dayStart))) return [];
  return calendar.week[dubaiWeekday(dayStart)].map((w) => [
    dayStart + w.start * MINUTE_MS,
    dayStart + w.end * MINUTE_MS,
  ]);
}

function workingMs(fromMs: number, toMs: number, calendar: WorkingCalendar): number {
  let total = 0;
  let days = 0;
  for (let day = dubaiDayStart(fromMs); day < toMs; day += DAY_MS) {
    if (++days > MAX_DAYS) throw new Error("working time: span longer than ten years");
    for (const [start, end] of windowsOn(day, calendar)) {
      const a = Math.max(start, fromMs);
      const b = Math.min(end, toMs);
      if (b > a) total += b - a;
    }
  }
  return total;
}

/** Working seconds from `from` to `to`; negative when `to` is earlier. */
export function workingSecondsBetween(from: Date, to: Date, calendar: WorkingCalendar): number {
  const a = from.getTime();
  const b = to.getTime();
  if (a <= b) return Math.floor(workingMs(a, b, calendar) / 1000);
  const back = Math.floor(workingMs(b, a, calendar) / 1000);
  return back === 0 ? 0 : -back; // never -0
}

/** The instant `seconds` of working time after `from`. */
export function addWorkingSeconds(from: Date, seconds: number, calendar: WorkingCalendar): Date {
  if (seconds < 0) return subtractWorkingSeconds(from, -seconds, calendar);
  const start = from.getTime();
  let remaining = seconds * 1000;
  if (remaining === 0) return new Date(start);
  let days = 0;
  for (let day = dubaiDayStart(start); days <= MAX_DAYS; day += DAY_MS, days++) {
    for (const [windowStart, windowEnd] of windowsOn(day, calendar)) {
      const a = Math.max(windowStart, start);
      if (a >= windowEnd) continue;
      const available = windowEnd - a;
      if (remaining <= available) return new Date(a + remaining);
      remaining -= available;
    }
  }
  throw new Error("working time: no working hours in the next ten years");
}

/** The instant `seconds` of working time before `to`. */
export function subtractWorkingSeconds(to: Date, seconds: number, calendar: WorkingCalendar): Date {
  if (seconds < 0) return addWorkingSeconds(to, -seconds, calendar);
  const end = to.getTime();
  let remaining = seconds * 1000;
  if (remaining === 0) return new Date(end);
  let days = 0;
  for (let day = dubaiDayStart(end); days <= MAX_DAYS; day -= DAY_MS, days++) {
    const windows = windowsOn(day, calendar);
    for (let i = windows.length - 1; i >= 0; i--) {
      const [windowStart, windowEnd] = windows[i];
      const b = Math.min(windowEnd, end);
      if (b <= windowStart) continue;
      const available = b - windowStart;
      if (remaining <= available) return new Date(b - remaining);
      remaining -= available;
    }
  }
  throw new Error("working time: no working hours in the last ten years");
}

export type SlaPolicy = {
  /** Working time the team has to answer: 24 h by default. */
  budgetSeconds: number;
  /** "At risk" once this much or less is left: 4 h by default. */
  riskSeconds: number;
  calendar: WorkingCalendar;
};

/** The policy in force, from the `mortgage_settings` row and `mortgage_holidays`. */
export function slaPolicy(
  settings: { sla_budget_minutes: number; sla_risk_minutes: number; working_hours: unknown },
  holidays: Iterable<string> = [],
): SlaPolicy {
  return {
    budgetSeconds: settings.sla_budget_minutes * 60,
    riskSeconds: settings.sla_risk_minutes * 60,
    calendar: calendarFromSettings(settings.working_hours, holidays),
  };
}

/** The clock columns of a `mortgage_requests` row. */
export type SlaFields = {
  sla_started_at: string | null;
  sla_due_at: string | null;
  sla_paused_at: string | null;
  sla_remaining_seconds: number | null;
  sla_stopped_at: string | null;
};

export type SlaState = "none" | "running" | "at_risk" | "paused" | "met" | "breached";

export type SlaStatus = {
  state: SlaState;
  /** Set once the clock has stopped (met, or breached and then decided). */
  stopped: boolean;
  /** Working seconds left; negative once past due. Null with no clock. */
  remainingSeconds: number | null;
  /** Working seconds used of the budget; more than the budget once breached. */
  elapsedSeconds: number | null;
  /** When the promise falls due. Null with no clock, and while paused. */
  dueAt: string | null;
  /** Share of the budget used, 0–100, for the clock's bar. */
  pct: number | null;
};

const NO_CLOCK: SlaStatus = {
  state: "none",
  stopped: false,
  remainingSeconds: null,
  elapsedSeconds: null,
  dueAt: null,
  pct: null,
};

/**
 * Where a request's promise stands at `now` — the one function every display
 * uses (SPEC §2.5). Consultancy requests have no clock and get `none`.
 */
export function slaStatus(request: SlaFields, now: Date, policy: SlaPolicy): SlaStatus {
  if (!request.sla_started_at) return NO_CLOCK;
  const { budgetSeconds, riskSeconds, calendar } = policy;

  const status = (
    state: SlaState,
    remainingSeconds: number,
    dueAt: string | null,
    stopped = false,
  ): SlaStatus => {
    const elapsedSeconds = budgetSeconds - remainingSeconds;
    return {
      state,
      stopped,
      remainingSeconds,
      elapsedSeconds,
      dueAt,
      pct: Math.min(100, Math.max(0, (elapsedSeconds / budgetSeconds) * 100)),
    };
  };

  if (request.sla_stopped_at) {
    const stoppedAt = new Date(request.sla_stopped_at);
    if (!request.sla_due_at) {
      const remaining = request.sla_remaining_seconds ?? 0;
      return status(remaining >= 0 ? "met" : "breached", remaining, null, true);
    }
    const due = new Date(request.sla_due_at);
    return status(
      stoppedAt.getTime() <= due.getTime() ? "met" : "breached",
      workingSecondsBetween(stoppedAt, due, calendar),
      request.sla_due_at,
      true,
    );
  }

  if (request.sla_paused_at) {
    return status("paused", request.sla_remaining_seconds ?? 0, null);
  }

  if (!request.sla_due_at) return NO_CLOCK;
  const due = new Date(request.sla_due_at);
  const remaining = workingSecondsBetween(now, due, calendar);
  // Breached is past the due instant, even when no working time has passed since.
  if (now.getTime() > due.getTime()) return status("breached", remaining, request.sla_due_at);
  return status(remaining <= riskSeconds ? "at_risk" : "running", remaining, request.sla_due_at);
}

/** `p_sla_due_at` for `mortgage_create_request()`: one budget of working time after submission. */
export function clockDueFrom(submittedAt: Date, policy: SlaPolicy): string {
  return addWorkingSeconds(submittedAt, policy.budgetSeconds, policy.calendar).toISOString();
}

/** `p_sla` for a pause (entering awaiting_applicant): the working time left, frozen. */
export function clockPause(
  request: Pick<SlaFields, "sla_due_at">,
  at: Date,
  policy: SlaPolicy,
): { remaining_seconds: number } {
  if (!request.sla_due_at) throw new Error("the clock isn't running");
  return {
    remaining_seconds: workingSecondsBetween(at, new Date(request.sla_due_at), policy.calendar),
  };
}

/**
 * `p_sla` for a resume (leaving awaiting_applicant): the frozen remainder,
 * counted from now. Time remaining after a resume equals time remaining at the
 * pause, however long the applicant took (PLAN Phase 5).
 */
export function clockResume(
  request: Pick<SlaFields, "sla_remaining_seconds">,
  at: Date,
  policy: SlaPolicy,
): { due_at: string } {
  if (request.sla_remaining_seconds === null) throw new Error("the clock isn't paused");
  return {
    due_at: addWorkingSeconds(at, request.sla_remaining_seconds, policy.calendar).toISOString(),
  };
}

/**
 * "17h 42m", "1h 48m", "21h 05m", "12m" — minutes are two digits once there
 * are hours (CMS foundations §7). The sign is dropped; say "overdue" around it.
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.abs(seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}
