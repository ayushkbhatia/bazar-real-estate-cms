import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { promiseRecord, type PromiseRecord } from "../metrics";
import type { SlaPolicy } from "../sla";

/** The Fast Pre-Approvals decided in the last `days` days, read through the Head's own session (RLS). */
export async function loadPromiseRecord(
  db: SupabaseClient,
  ctx: { now: Date; policy: SlaPolicy; days: number },
): Promise<PromiseRecord> {
  const since = new Date(ctx.now.getTime() - ctx.days * 86_400_000).toISOString();
  const { data, error } = await db
    .from("mortgage_requests")
    .select("sla_started_at, sla_due_at, sla_paused_at, sla_remaining_seconds, sla_stopped_at")
    .eq("service", "pre_approval")
    .gte("sla_stopped_at", since)
    .limit(1000);
  if (error) throw new Error(`promise record read failed: ${error.code}`);
  return promiseRecord((data ?? []) as Parameters<typeof promiseRecord>[0], ctx.now, ctx.policy);
}
