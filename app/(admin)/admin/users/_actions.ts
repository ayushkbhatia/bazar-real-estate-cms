"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { staffInvitationTemplate } from "@/lib/email-templates";
import { absoluteUrl } from "@/lib/site-url";
import { INVITE_EXPIRY_DAYS } from "@/lib/staff-invitations";
import {
  staffInviteSchema,
  staffRoleUpdateSchema,
  staffStatusUpdateSchema,
  STAFF_ROLES,
  ROLE_LABEL,
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

  const sent = await sendInvitationEmail({
    email: parsed.data.email,
    displayName: parsed.data.display_name,
    role: parsed.data.role,
    token,
  });

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
  return sent.ok
    ? { status: "ok", message: `Invitation emailed to ${parsed.data.email}.` }
    : {
        status: "ok",
        // The invitation row exists and the link works, so this isn't a
        // failure — but saying "sent" when no mail left would send an admin
        // away believing the invitee has a link.
        message: `Invitation created, but the email didn't send (${sent.reason}). Use Resend once email is configured.`,
      };
}

/**
 * Send the invitation email ourselves, through Resend.
 *
 * This used to be `auth.admin.inviteUserByEmail`, which is why the mail arrived
 * from "Supabase Auth" with Supabase's own template, and why the link pointed at
 * the project's configured Site URL (localhost). Both problems were the same
 * problem: the email wasn't ours.
 *
 * Two further consequences of dropping it, worth knowing:
 *  · It no longer creates an auth.users row at invite time. That row appearing
 *    early is what fired the accept trigger and marked invitations "accepted"
 *    while the invitee still had no password (see migration 0064).
 *  · The link now carries our own `staff_invitations.token`, so acceptance is
 *    our flow end to end and doesn't depend on Supabase redirect allow-lists.
 */
async function sendInvitationEmail(opts: {
  email: string;
  displayName: string;
  role: StaffRole;
  token: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: inviter } = user
      ? await supabase
          .from("staff")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle()
      : { data: null };

    const acceptUrl = await absoluteUrl(
      `/staff-invite?token=${encodeURIComponent(opts.token)}`,
    );
    const tpl = staffInvitationTemplate({
      inviteeName: opts.displayName.split(" ")[0] ?? opts.displayName,
      inviterName: inviter?.display_name ?? "A Bazar administrator",
      acceptUrl,
      role: ROLE_LABEL[opts.role] ?? opts.role,
      expiryDays: INVITE_EXPIRY_DAYS,
    });
    const result = await sendEmail({
      to: opts.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
    if (result.status === "ok") return { ok: true };
    return {
      ok: false,
      reason: result.status === "skipped" ? result.reason : result.message,
    };
  } catch (err) {
    console.error("[sendInvitationEmail]", err);
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Re-send an invitation: fresh token, fresh 14-day window, activation cleared.
 *
 * Needed because an invitation can be stranded — auth user created, staff row
 * created, `accepted_at` stamped by the trigger, but no password ever set
 * because the emailed link was unusable. Revoking and re-inviting doesn't
 * recover that state cleanly (the address already has an auth user), so the
 * repair is a new link against the same invitation.
 */
export async function resendInvitation(
  invitationId: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return envUnsetResult();
  await requireRole(["admin"]);

  const admin = createAdminClient();
  if (!admin)
    return {
      status: "error",
      message: "Service-role key is not configured — can't re-issue the token.",
    };

  const token = randomBytes(24).toString("base64url");
  const { data, error } = await admin
    .from("staff_invitations")
    .update({
      token,
      activated_at: null,
      expires_at: new Date(
        Date.now() + INVITE_EXPIRY_DAYS * 86_400_000,
      ).toISOString(),
    })
    .eq("id", invitationId)
    .select("email, display_name, role")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Invitation not found." };

  const sent = await sendInvitationEmail({
    email: data.email,
    displayName: data.display_name,
    role: data.role as StaffRole,
    token,
  });

  await logAudit({
    action: "staff.resend_invitation",
    target_kind: "staff_invitation",
    target_id: invitationId,
    before: null,
    after: { email: data.email, emailed: sent.ok },
  });

  revalidatePath("/admin/users");
  return sent.ok
    ? { status: "ok", message: `New link emailed to ${data.email}.` }
    : {
        status: "error",
        message: `New link created but the email failed: ${sent.reason}`,
      };
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
