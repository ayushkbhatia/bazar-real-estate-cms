"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import {
  linkState,
  linkStateMessage,
  type InvitationRow,
} from "@/lib/staff-invitations";

/**
 * Activating a staff invitation.
 *
 * This route is reached by someone with no session at all, so every read and
 * write goes through the service-role client — RLS on `staff_invitations`
 * grants nothing to anonymous, by design. The emailed token is the only
 * credential, which is the same security model as a password-reset link: 24
 * random bytes, sent to the address being proved, single-use, 14-day expiry.
 */

const activateSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match.",
  });

export type ActivateResult =
  | { status: "ok"; email: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const FIELDS =
  "email, display_name, role, expires_at, accepted_at, activated_at";

export async function activateInvitation(
  raw: Record<string, unknown>,
): Promise<ActivateResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const parsed = activateSchema.safeParse({
    token: typeof raw.token === "string" ? raw.token : "",
    password: typeof raw.password === "string" ? raw.password : "",
    confirm: typeof raw.confirm === "string" ? raw.confirm : "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Check the fields below.",
      fieldErrors,
    };
  }

  const admin = createAdminClient();
  if (!admin)
    return {
      status: "error",
      message: "Service-role key is not configured — can't activate accounts.",
    };

  // Re-check the token here rather than trusting the page that rendered the
  // form: the link could have been used in another tab since it loaded.
  const { data: invitation } = await admin
    .from("staff_invitations")
    .select(FIELDS)
    .eq("token", parsed.data.token)
    .maybeSingle();

  const state = linkState(invitation as InvitationRow | null, Date.now());
  if (!state.usable)
    return { status: "error", message: linkStateMessage(state.reason) };

  const row = invitation as InvitationRow;

  // The address may already have an auth user — the old invite flow created one
  // at invite time, and the person may also have signed up as a customer. In
  // both cases set the password on the existing account rather than failing:
  // holding this token already proves control of the mailbox.
  const existing = await findUserByEmail(admin, row.email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: parsed.data.password,
      email_confirm: true,
    });
    if (error) return { status: "error", message: error.message };
    // The accept trigger only fires on INSERT, so an account that predates the
    // invitation has no staff row. Materialise it.
    const staffError = await ensureStaffRow(admin, existing.id, row);
    if (staffError) return { status: "error", message: staffError };
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: row.email,
      password: parsed.data.password,
      // Holding the token is the email proof; a second confirmation round-trip
      // would just be another link to get wrong.
      email_confirm: true,
      user_metadata: {
        first_name: row.display_name.split(" ")[0] ?? "",
        bazar_staff_invite: true,
      },
    });
    if (error) return { status: "error", message: error.message };
    // on_auth_user_accept_invitation (0010) creates the staff row and stamps
    // accepted_at from here.
  }

  const { error: markError } = await admin
    .from("staff_invitations")
    .update({
      activated_at: new Date().toISOString(),
      // Belt and braces: the trigger sets this on insert, but the
      // existing-user path above never inserts.
      accepted_at: row.accepted_at ?? new Date().toISOString(),
    })
    .eq("token", parsed.data.token);
  if (markError) {
    // The account is usable at this point, so don't fail the activation — but
    // an un-marked invitation means a reusable link, which must not pass
    // quietly.
    console.error("[activateInvitation] failed to mark activated", markError);
  }

  await logAudit({
    action: "staff.invitation_activated",
    target_kind: "staff_invitation",
    target_id: row.email,
    before: null,
    after: { email: row.email, role: row.role, existing_account: !!existing },
  });

  return { status: "ok", email: row.email };
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function findUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<{ id: string } | null> {
  // listUsers is paginated and has no email filter in this SDK version; staff
  // lists are small, but page through rather than assuming one page.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data) return null;
    const match = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (match) return { id: match.id };
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Create the staff row for an account that already existed, mirroring what
 * `handle_staff_invitation` does in SQL — including the slug de-duplication,
 * since two people called Omar Hasan would otherwise collide on the unique
 * slug index.
 */
async function ensureStaffRow(
  admin: AdminClient,
  userId: string,
  row: InvitationRow,
): Promise<string | null> {
  const { data: already } = await admin
    .from("staff")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (already) return null;

  const base =
    row.display_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "staff";

  const { data: taken } = await admin
    .from("staff")
    .select("slug")
    .like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((s) => s.slug));
  let slug = base;
  for (let n = 1; used.has(slug); n++) slug = `${base}-${n}`;

  const { error } = await admin.from("staff").insert({
    user_id: userId,
    display_name: row.display_name,
    slug,
    role: row.role as "admin" | "editor" | "agent" | "marketing" | "support",
    status: "active",
    joined_at: new Date().toISOString().slice(0, 10),
  });
  return error ? error.message : null;
}
