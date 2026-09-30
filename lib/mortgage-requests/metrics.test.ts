import { describe, expect, it } from "vitest";
import { promiseRecord } from "./metrics";
import { clockDueFrom, DEFAULT_WORKING_HOURS, slaPolicy, type SlaFields } from "./sla";

const policy = slaPolicy({ sla_budget_minutes: 1440, sla_risk_minutes: 240, working_hours: DEFAULT_WORKING_HOURS });

/** Submitted Sun 20 Sep 09:00 in Dubai: due Tue 22 Sep 13:00 (24 working hours). */
const START = new Date("2026-09-20T05:00:00Z");

function decided(stoppedAt: string): SlaFields {
  return {
    sla_started_at: START.toISOString(),
    sla_due_at: clockDueFrom(START, policy),
    sla_paused_at: null,
    sla_remaining_seconds: null,
    sla_stopped_at: stoppedAt,
  };
}

describe("the promise, looked back on", () => {
  const now = new Date("2026-09-30T08:00:00Z");

  it("counts what was decided in time, and the median working time it took", () => {
    const record = promiseRecord(
      [
        decided("2026-09-21T08:00:00Z"), // Mon 12:00: 10h Sunday + 3h Monday
        decided("2026-09-23T06:00:00Z"), // Wed 10:00: past Tuesday 13:00
        decided("2026-09-21T06:00:00Z"), // Mon 10:00: 11h
      ],
      now,
      policy,
    );
    expect(record).toMatchObject({ decided: 3, met: 2, missed: 1, metPct: 67, medianSeconds: 13 * 3600 });
  });

  it("leaves out requests with no clock or one still running", () => {
    const consultancy: SlaFields = { sla_started_at: null, sla_due_at: null, sla_paused_at: null, sla_remaining_seconds: null, sla_stopped_at: null };
    const running = { ...decided("2026-09-21T08:00:00Z"), sla_stopped_at: null };
    expect(promiseRecord([consultancy, running], now, policy)).toEqual({ decided: 0, met: 0, missed: 0, metPct: null, medianSeconds: null });
  });

  it("reads a clock stopped while paused by the time left at the pause", () => {
    const paused: SlaFields = {
      sla_started_at: START.toISOString(),
      sla_due_at: null,
      sla_paused_at: "2026-09-21T06:00:00Z",
      sla_remaining_seconds: 5 * 3600,
      sla_stopped_at: "2026-09-25T06:00:00Z",
    };
    expect(promiseRecord([paused], now, policy)).toMatchObject({ decided: 1, met: 1, metPct: 100 });
  });
});
