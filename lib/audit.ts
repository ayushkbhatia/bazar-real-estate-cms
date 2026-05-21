import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type AuditEntry = {
  action: string;
  target_kind: string;
  target_id: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * Append a row to `audit_log`. Best-effort: failures are logged and swallowed
 * so a failed audit write never blocks the user-visible operation.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      console.warn("[audit] insert failed", entry.action, error.message);
    }
  } catch (err) {
    console.warn("[audit] threw", (err as Error).message);
  }
}
