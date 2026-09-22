import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSalesforceConfigured } from "@/lib/env";
import type { Database } from "@/db/types";
import { scrubLead } from "./erasure";

/**
 * Draining `enquiries.crm_erasure_due_at`.
 *
 * Shared by two callers that want the same work done at different moments:
 * the admin erasure action, which runs it inline so the staff member sees the
 * CRM outcome on the same screen as the Postgres one; and the sync cron,
 * which picks up anything that outage, timeout or crash left behind.
 *
 * Both reach here rather than one calling the other, because the action must
 * not depend on a cron having run and the cron must not depend on an admin
 * being logged in.
 */

/** Generous: erasure is rare, and a backlog means an obligation is overdue. */
const ERASURE_BATCH = 100;

export type ErasureDrainResult = {
  /** Records the CRM confirmed as pseudonymised (or already gone). */
  scrubbed: number;
  /** Still outstanding — the marker is left in place for the next run. */
  remaining: number;
  /** Rows with no CRM record at all, retired without a call. */
  cleared: number;
  lastError: string | null;
};

type DueRow = {
  id: string;
  name: string;
  crm_external_id: string | null;
};

/**
 * Pseudonymise the Salesforce side of every row awaiting erasure.
 *
 * The pseudonym is read back off the enquiry rather than generated here:
 * `anonymise_by_email` (0067) builds `deleted-<hex>` in Postgres, and reusing
 * that exact value keeps the two systems describing the same subject with the
 * same token. Inventing a second one would make the CRM record and the
 * database row impossible to reconcile during an audit.
 *
 * Never throws. An erasure request's legal obligation is discharged by the
 * Postgres scrub, which has already happened by the time anything here runs;
 * a Salesforce failure is a follow-up task, not a reason to fail the request
 * back to the staff member.
 */
export async function drainCrmErasures(
  admin: SupabaseClient<Database>,
  opts: { limit?: number } = {},
): Promise<ErasureDrainResult> {
  const out: ErasureDrainResult = {
    scrubbed: 0,
    remaining: 0,
    cleared: 0,
    lastError: null,
  };

  const { data, error } = await admin
    .from("enquiries")
    .select("id, name, crm_external_id")
    .not("crm_erasure_due_at", "is", null)
    .order("crm_erasure_due_at", { ascending: true })
    .limit(opts.limit ?? ERASURE_BATCH);

  if (error) {
    out.lastError = error.message;
    return out;
  }

  const rows = (data ?? []) as DueRow[];
  if (rows.length === 0) return out;

  // A row that was queued but never actually reached Salesforce — still
  // pending when the request came in, or failed permanently — has nothing to
  // scrub. Retire it without spending a call.
  const withoutRecord = rows.filter((r) => !r.crm_external_id);
  if (withoutRecord.length > 0) {
    await admin
      .from("enquiries")
      .update({ crm_erasure_due_at: null })
      .in(
        "id",
        withoutRecord.map((r) => r.id),
      );
    out.cleared = withoutRecord.length;
  }

  const withRecord = rows.filter((r) => r.crm_external_id);
  if (withRecord.length === 0) return out;

  // Nothing to talk to. The markers stay put, which is the whole point of
  // them: the obligation stays visible until the credentials exist.
  if (!isSalesforceConfigured) {
    out.remaining = withRecord.length;
    out.lastError = "Salesforce is not configured";
    return out;
  }

  for (const row of withRecord) {
    const result = await scrubLead(row.crm_external_id!, row.name);
    if (result.ok) {
      await admin
        .from("enquiries")
        .update({ crm_erasure_due_at: null })
        .eq("id", row.id);
      out.scrubbed += 1;
      continue;
    }

    out.remaining += 1;
    out.lastError = result.message;

    // A non-retryable failure will not fix itself, and an un-erased copy of a
    // subject who asked to be forgotten is the kind of thing that has to
    // reach a human rather than sit in a column.
    if (!result.retryable) {
      Sentry.captureMessage("Salesforce erasure cannot complete", {
        level: "error",
        tags: { component: "salesforce/erasure" },
        contexts: {
          enquiry: { id: row.id, error: result.message },
        },
      });
    }
  }

  return out;
}
