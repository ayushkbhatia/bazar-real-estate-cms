import type { SupabaseClient } from "@supabase/supabase-js";
import { allRows } from "@/lib/salesforce/listings/paginate";
import { slaStatus, type SlaFields } from "../sla";
import { loadMortgageSettings } from "./settings";

/**
 * The 24-hour promise's alarms (PLAN Phase 4 "sla.tick"; SPEC §2.5, §6):
 * every running Fast Pre-Approval is checked against sla.ts, and one that
 * has reached its last four working hours, or its due time, is flagged
 * through `mortgage_flag_sla()` — which raises each alarm once per promise
 * (the `sla_*_notified_at` columns, cleared when a paused clock resumes) and
 * queues the bell and email for the owner and the Head of mortgages.
 *
 * Idempotent by construction: a second run in the same state flags nothing,
 * and two overlapping runs can't both raise one alarm (the function locks the
 * row). The maths is sla.ts's; the database only records that it was done.
 *
 * Runs inside the mortgage-worker cron, every five minutes, so the alerts it
 * queues go out in the same run.
 */

type Running = SlaFields & {
  id: string;
  sla_risk_notified_at: string | null;
  sla_breach_notified_at: string | null;
};

export type SlaTickReport = { checked: number; atRisk: number; breached: number };

export async function slaTick(deps: {
  db: SupabaseClient;
  now?: () => Date;
  /** Check only these requests (a targeted run; the tests' fake clock). */
  requestIds?: readonly string[];
}): Promise<SlaTickReport> {
  const now = deps.now?.() ?? new Date();
  const { policy } = await loadMortgageSettings(deps.db);

  // Running and not yet reported breached: a promise already reported missed
  // has nothing left to say until it resumes.
  const rows = await allRows<Running>((from, to) => {
    let query = deps.db
      .from("mortgage_requests")
      .select(
        "id, sla_started_at, sla_due_at, sla_paused_at, sla_remaining_seconds, sla_stopped_at, sla_risk_notified_at, sla_breach_notified_at",
      )
      .eq("service", "pre_approval")
      .not("sla_started_at", "is", null)
      .not("sla_due_at", "is", null)
      .is("sla_stopped_at", null)
      .is("sla_paused_at", null)
      .is("sla_breach_notified_at", null);
    if (deps.requestIds) query = query.in("id", [...deps.requestIds]);
    return query.order("id").range(from, to) as unknown as PromiseLike<{ data: Running[] | null; error: { message: string } | null }>;
  });

  const report: SlaTickReport = { checked: rows.length, atRisk: 0, breached: 0 };
  for (const row of rows) {
    const { state } = slaStatus(row, now, policy);
    // Breached outranks at risk: a promise that went from running to missed
    // between two runs (a long weekend, a cron outage) is reported missed.
    const flag = state === "breached" ? "breached" : state === "at_risk" && !row.sla_risk_notified_at ? "at_risk" : null;
    if (!flag) continue;
    const { data, error } = await deps.db.rpc("mortgage_flag_sla", {
      p_request_id: row.id,
      p_state: flag,
      p_at: now.toISOString(),
    });
    if (error) throw new Error(`sla flag failed: ${error.code ?? error.message}`);
    if (data === true) report[flag === "breached" ? "breached" : "atRisk"] += 1;
  }
  return report;
}
