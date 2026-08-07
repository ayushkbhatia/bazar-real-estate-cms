"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { currentUserIsAdmin, getStaffAuthMeta } from "@/lib/queries/staff";
import { issueStaffPasswordLink } from "@/lib/staff-password-link";
import {
  agentEditSchema,
  normaliseAgentEdit,
  type AgentEditInput,
} from "@/lib/schemas/agent";
import { logAudit } from "@/lib/audit";

type ActionResult =
  | { status: "ok" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Record<string, string>;
    };

export async function updateAgentAction(
  userId: string,
  input: AgentEditInput,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Backend not configured." };
  }
  if (!(await currentUserIsAdmin())) {
    return { status: "error", message: "Admins only." };
  }

  const parsed = agentEditSchema.safeParse(
    normaliseAgentEdit(input as unknown as Record<string, unknown>),
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Check the fields.", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("staff")
    .select(
      "display_name, slug, title, brn, bio, photo_url, languages, specialties, credentials, public_email, public_phone, whatsapp",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("staff")
    .update({
      display_name: parsed.data.display_name,
      slug: parsed.data.slug,
      title: parsed.data.title ?? null,
      brn: parsed.data.brn ?? null,
      bio: parsed.data.bio ?? null,
      photo_url: parsed.data.photo_url ?? null,
      languages: parsed.data.languages,
      specialties: parsed.data.specialties,
      credentials: parsed.data.credentials,
      public_email: parsed.data.public_email ?? null,
      public_phone: parsed.data.public_phone ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
    })
    .eq("user_id", userId);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "Slug already in use. Pick a different one.",
        fieldErrors: { slug: "Slug already in use" },
      };
    }
    console.error("[updateAgentAction]", error);
    return { status: "error", message: "Could not save." };
  }

  await logAudit({
    action: "staff.update",
    target_kind: "staff",
    target_id: userId,
    before,
    after: parsed.data,
  });

  revalidatePath("/admin/agents");
  revalidatePath(`/admin/agents/${userId}`);
  return { status: "ok" };
}

export type PasswordLinkResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Email an existing staff member a one-time link to set a new password.
 *
 * Rides on the same `staff_invitations` token the invite flow uses, marked
 * `purpose = 'reset'` (0065). Reusing it means one accept page, one email
 * sender and one expiry rule — and, importantly, no dependence on Supabase's
 * recovery email, which arrives from "Supabase Auth" with a link resolved
 * against the project's Site URL.
 *
 * The staff row and role are untouched: this only grants the ability to set a
 * password. Anyone holding the link can set one, which is the same trust model
 * as any password-reset email, so the action is admin-only and audited.
 */
export async function sendStaffPasswordLink(
  userId: string,
): Promise<PasswordLinkResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Backend not configured." };
  if (!(await currentUserIsAdmin()))
    return { status: "error", message: "Admins only." };

  const admin = createAdminClient();
  if (!admin)
    return {
      status: "error",
      message: "Service-role key is not configured — can't issue a link.",
    };

  const supabase = await createSupabaseServerClient();
  const { data: staff } = await supabase
    .from("staff")
    .select("user_id, display_name, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!staff) return { status: "error", message: "Staff member not found." };
  if (staff.status === "suspended")
    return {
      status: "error",
      message:
        "This account is suspended. Restore it first — a password link would let a suspended user back in.",
    };

  const meta = await getStaffAuthMeta(userId);
  if (!meta?.email)
    return {
      status: "error",
      message:
        "No email address on this account, so there's nowhere to send the link.",
    };

  // Who's sending, for the email body and the audit trail.
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  const { data: actorStaff } = actor
    ? await supabase
        .from("staff")
        .select("display_name")
        .eq("user_id", actor.id)
        .maybeSingle()
    : { data: null };

  // Shared with /forgot-password so both surfaces agree on token lifetime,
  // single-use semantics and the wording of the email.
  const issued = await issueStaffPasswordLink({
    email: meta.email,
    senderName: actorStaff?.display_name ?? "A Bazar administrator",
    invitedBy: actor?.id ?? null,
  });
  if (issued.status === "error")
    return { status: "error", message: issued.message };
  if (issued.status === "suspended")
    return {
      status: "error",
      message:
        "This account is suspended. Restore it first — a password link would let a suspended user back in.",
    };
  if (issued.status === "no_such_staff")
    return { status: "error", message: "No staff account for that address." };

  await logAudit({
    action: "staff.password_link_sent",
    target_kind: "staff",
    target_id: userId,
    before: null,
    after: { email: meta.email, emailed: true },
  });

  revalidatePath(`/admin/agents/${userId}`);
  revalidatePath("/admin/users");

  return { status: "ok", message: `Password link emailed to ${meta.email}.` };
}
