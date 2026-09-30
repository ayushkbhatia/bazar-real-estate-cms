/**
 * The 24-hour promise, looked back on (PLAN Phase 7: "SLA met-rate metric"):
 * of the Fast Pre-Approvals decided in a window, how many were decided within
 * their 24 working hours, and the typical working time it took. Every figure
 * comes from sla.ts's `slaStatus()`, the one place deadline maths lives.
 */

import { slaStatus, type SlaFields, type SlaPolicy } from "./sla";

export type PromiseRecord = {
  /** Decided in the window, with a clock. */
  decided: number;
  met: number;
  missed: number;
  /** Whole percent met, or null with nothing decided. */
  metPct: number | null;
  /** The median working time from submission to decision, in seconds; null with nothing decided. */
  medianSeconds: number | null;
};

export function promiseRecord(rows: readonly SlaFields[], now: Date, policy: SlaPolicy): PromiseRecord {
  const outcomes = rows
    .filter((r) => r.sla_started_at && r.sla_stopped_at)
    .map((r) => slaStatus(r, now, policy))
    .filter((s) => s.stopped && (s.state === "met" || s.state === "breached"));
  const met = outcomes.filter((s) => s.state === "met").length;
  const elapsed = outcomes
    .map((s) => s.elapsedSeconds)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const mid = Math.floor(elapsed.length / 2);
  return {
    decided: outcomes.length,
    met,
    missed: outcomes.length - met,
    metPct: outcomes.length ? Math.round((met / outcomes.length) * 100) : null,
    medianSeconds: elapsed.length === 0 ? null : elapsed.length % 2 ? elapsed[mid]! : Math.round((elapsed[mid - 1]! + elapsed[mid]!) / 2),
  };
}
