import { reportError } from "@/lib/observability";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export type AuditEntry = {
  action: string;
  target_kind: string;
  /**
   * What the action touched: a row's uuid, or the key a singleton, form, code,
   * slug or data subject is known by ("1", "rail", a form key, an email). The
   * column is text since 0153; while it was a uuid, every non-uuid id here
   * failed the insert and the row was lost. Null when there is no one target.
   */
  target_id: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * Append a row to `audit_log`. Best-effort: failures are reported and
 * swallowed so a failed audit write never blocks the user-visible operation.
 *
 * The audit log is our PDPL/AML compliance evidence — silent drops are
 * unacceptable, so insert failures go through `reportError` with source
 * "audit": stored in `error_events` (/admin/settings/health) and forwarded
 * to Sentry when a DSN is set.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = await createSupabaseServerClient();
    // Request-cached: the caller almost always resolved the same user already.
    const user = await getCurrentUser();
    if (!user) return; // nothing to do for anonymous; RLS would block anyway

    type Json =
      | string
      | number
      | boolean
      | null
      | { [k: string]: Json | undefined }
      | Json[];
    const { error } = await supabase.from("audit_log").insert({
      actor_id: user.id,
      actor_kind: "user",
      action: entry.action,
      target_kind: entry.target_kind,
      target_id: entry.target_id,
      before: (entry.before ?? null) as Json,
      after: (entry.after ?? null) as Json,
    });
    if (error) {
      await reportError(error, {
        source: "audit",
        context: {
          audit: {
            action: entry.action,
            target_kind: entry.target_kind,
            target_id: entry.target_id,
          },
        },
      });
    }
  } catch (err) {
    await reportError(err, {
      source: "audit",
      context: {
        audit: {
          action: entry.action,
          target_kind: entry.target_kind,
          target_id: entry.target_id,
        },
      },
    });
  }
}
