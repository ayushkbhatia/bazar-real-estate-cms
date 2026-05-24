"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, env } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import {
  staffInviteSchema,
  staffRoleUpdateSchema,
  staffStatusUpdateSchema,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/schemas/staff";

export type ActionResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

function envUnsetResult(): ActionResult {
  return { status: "error", message: "Supabase env vars are not set." };
}

export async function inviteStaff(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return envUnsetResult();
  await requireRole(["admin"]);

  const parsed = staffInviteSchema.safeParse({
    email: typeof raw.email === "string" ? raw.email : "",
    display_name:
      typeof raw.display_name === "string" ? raw.display_name : "",
    role: typeof raw.role === "string" ? raw.role : "agent",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      status: "error",
      message:
        "Service-role key is not configured — invites can't send email until SUPABASE_SERVICE_ROLE_KEY is set.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const invitedBy = user?.id ?? null;
  const token = randomBytes(24).toString("base64url");

  // Idempotency: clear any expired or already-accepted pending row for the
  // same email so the unique partial index doesn't reject us.
  await admin
    .from("staff_invitations")
    .delete()
    .ilike("email", parsed.data.email)
    .or("accepted_at.not.is.null,expires_at.lt.now()");

  const { data: insertResult, error: insertError } = await admin
    .from("staff_invitations")
    .insert({
      email: parsed.data.email,
      display_name: parsed.data.display_name,
      role: parsed.data.role,
      token,
      invited_by: invitedBy,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        status: "error",
        message:
          "There's already a pending invitation for this email. Revoke it first to re-send.",
        fieldErrors: { email: "Already invited" },
      };
    }
    return { status: "error", message: insertError.message };
  }

  // Best-effort email send. We continue even if it fails — the admin can
  // resend manually. The trigger on auth.users still binds the invitation
  // when the user signs up later.
  try {
    const redirectTo = env.NEXT_PUBLIC_SITE_URL
      ? `${env.NEXT_PUBLIC_SITE_URL}/admin?invite_accepted=1`
      : undefined;
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        data: {
          first_name: parsed.data.display_name.split(" ")[0] ?? "",
          bazar_staff_invite: true,
          role: parsed.data.role,
        },
        ...(redirectTo ? { redirectTo } : {}),
      },
    );
    if (inviteError) {
      console.warn("[inviteStaff] supabase invite failed:", inviteError.message);
    }
  } catch (err) {
    console.warn("[inviteStaff] threw:", (err as Error).message);
  }

  await logAudit({
    action: "staff.invite",
    target_kind: "staff_invitation",
    target_id: insertResult?.id ?? "",
    before: null,
    after: {
      email: parsed.data.email,
      role: parsed.data.role,
      display_name: parsed.data.display_name,
    },
  });

  revalidatePath("/admin/users");
  return { status: "ok", message: "Invitation sent." };
}

export async function revokeInvitation(
  invitationId: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return envUnsetResult();
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("staff_invitations")
    .delete()
    .eq("id", invitationId);
  if (error) return { status: "error", message: error.message };
  await logAudit({
    action: "staff.revoke_invitation",
    target_kind: "staff_invitation",
    target_id: invitationId,
  });
  revalidatePath("/admin/users");
  return { status: "ok", message: "Invitation revoked." };
}

export async function updateStaffRole(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return envUnsetResult();
  await requireRole(["admin"]);
  const parsed = staffRoleUpdateSchema.safeParse({
    user_id: typeof raw.user_id === "string" ? raw.user_id : "",
    role: typeof raw.role === "string" ? raw.role : "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid role payload." };
  }
  if (!STAFF_ROLES.includes(parsed.data.role as StaffRole)) {
    return { status: "error", message: "Unknown role." };
  }
  const supabase = await createSupabaseServerClient();

  const { data: before } = await supabase
    .from("staff")
    .select("role")
    .eq("user_id", parsed.data.user_id)
    .maybeSingle();

  const { error } = await supabase
    .from("staff")
    .update({ role: parsed.data.role })
    .eq("user_id", parsed.data.user_id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "staff.role_change",
    target_kind: "staff",
    target_id: parsed.data.user_id,
    before: { role: before?.role ?? null },
    after: { role: parsed.data.role },
  });
  revalidatePath("/admin/users");
  return { status: "ok", message: "Role updated." };
}

export async function updateStaffStatus(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return envUnsetResult();
  await requireRole(["admin"]);
  const parsed = staffStatusUpdateSchema.safeParse({
    user_id: typeof raw.user_id === "string" ? raw.user_id : "",
    status: typeof raw.status === "string" ? raw.status : "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid status payload." };
  }

  const supabase = await createSupabaseServerClient();

  // Don't let an admin suspend themselves — would lock the org out.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === parsed.data.user_id && parsed.data.status === "suspended") {
    return {
      status: "error",
      message: "You can't suspend your own account.",
    };
  }

  const { data: before } = await supabase
    .from("staff")
    .select("status")
    .eq("user_id", parsed.data.user_id)
    .maybeSingle();

  const { error } = await supabase
    .from("staff")
    .update({ status: parsed.data.status })
    .eq("user_id", parsed.data.user_id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action:
      parsed.data.status === "suspended"
        ? "staff.suspend"
        : parsed.data.status === "active"
          ? "staff.restore"
          : "staff.status_change",
    target_kind: "staff",
    target_id: parsed.data.user_id,
    before: { status: before?.status ?? null },
    after: { status: parsed.data.status },
  });
  revalidatePath("/admin/users");
  return { status: "ok", message: "Status updated." };
}
