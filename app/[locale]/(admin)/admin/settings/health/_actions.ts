"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * Mark an error handled.
 *
 * Admin-only, and deliberately not a delete: the row stays, so a problem that
 * returns reopens with its history rather than arriving as a brand-new issue
 * with a count of one. `record_error_event` clears `resolved_at` on the next
 * occurrence — resolving is a statement about now, not a permanent silence.
 */
export async function resolveErrorEvent(
  id: unknown,
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  await requireRole(["admin"]);

  if (typeof id !== "string" || id.length < 10) {
    return { status: "error", message: "Bad id." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { status: "error", message: "Service-role key is not configured." };
  }

  const user = await getCurrentUser();
  const { error } = await admin
    .from("error_events")
    .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
    .eq("id", id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "health.error_resolved",
    target_kind: "error_event",
    target_id: id,
    before: null,
    after: null,
  });

  revalidatePath("/admin/settings/health");
  return { status: "ok" };
}
