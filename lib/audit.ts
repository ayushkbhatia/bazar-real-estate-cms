import * as Sentry from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export type AuditEntry = {
  action: string;
  target_kind: string;
  target_id: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * Append a row to `audit_log`. Best-effort: failures are reported to
 * Sentry and swallowed so a failed audit write never blocks the
 * user-visible operation.
 *
 * The audit log is our PDPL/AML compliance evidence — silent drops are
 * unacceptable, so we route insert failures through Sentry with a
 * dedicated tag for filtering and alerting.
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
      Sentry.captureException(error, {
        tags: { component: "audit" },
        contexts: {
          audit: {
            action: entry.action,
            target_kind: entry.target_kind,
            target_id: entry.target_id,
          },
        },
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: "audit" },
      contexts: {
        audit: {
          action: entry.action,
          target_kind: entry.target_kind,
          target_id: entry.target_id,
        },
      },
    });
  }
}
