import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { staffPasswordResetTemplate } from "@/lib/email-templates";
import { absoluteUrl } from "@/lib/site-url";
import { INVITE_EXPIRY_DAYS } from "@/lib/staff-invitations";

/**
 * Issue a single-use password link to a staff member, delivered by Resend.
 *
 * Shared by the two surfaces that can trigger one:
 *  · an admin, from Users & roles or an advisor profile
 *    (app/[locale]/(admin)/admin/agents/_actions.ts)
 *  · a locked-out staff member, from /forgot-password
 *
 * One implementation on purpose. Staff recovery previously ran through
 * Supabase's magic link, and the plan's D10 retires that: this is now the only
 * path back into an account, so the two callers must not drift on token
 * lifetime, single-use semantics or what the email says.
 *
 * Service-role throughout — /forgot-password is reached with no session at
 * all, and RLS grants anonymous nothing on staff_invitations.
 */

export type IssueResult =
  | { status: "sent"; email: string }
  | { status: "no_such_staff" }
  | { status: "suspended" }
  | { status: "error"; message: string };

/**
 * @param senderName who to name in the email. An admin's display name when a
 *   colleague triggered it; for a self-service request the person asked for it
 *   themselves, so the caller passes something neutral.
 */
export async function issueStaffPasswordLink(opts: {
  email: string;
  senderName: string;
  invitedBy?: string | null;
}): Promise<IssueResult> {
  const email = opts.email.trim().toLowerCase();
  if (!email.includes("@")) return { status: "no_such_staff" };

  const admin = createAdminClient();
  if (!admin)
    return {
      status: "error",
      message: "Service-role key is not configured — can't issue a link.",
    };

  try {
    // Resolve the address to an auth user, then to a staff row. Both must
    // exist: a password link is only ever for someone who can use the CMS.
    let userId: string | null = null;
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error || !data) break;
      const hit = data.users.find(
        (u) => (u.email ?? "").toLowerCase() === email,
      );
      if (hit) userId = hit.id;
      if (data.users.length < 200) break;
    }
    if (!userId) return { status: "no_such_staff" };

    const { data: staff } = await admin
      .from("staff")
      .select("display_name, role, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (!staff) return { status: "no_such_staff" };
    // A link would hand back exactly the access the suspension removed.
    if (staff.status === "suspended") return { status: "suspended" };

    const token = randomBytes(24).toString("base64url");

    // One outstanding reset per address: replace rather than accumulate, so an
    // older emailed link stops working the moment a new one is sent.
    await admin
      .from("staff_invitations")
      .delete()
      .ilike("email", email)
      .eq("purpose", "reset");

    const { error: insertError } = await admin.from("staff_invitations").insert({
      email,
      display_name: staff.display_name,
      role: staff.role,
      token,
      purpose: "reset",
      expires_at: new Date(
        Date.now() + INVITE_EXPIRY_DAYS * 86_400_000,
      ).toISOString(),
      invited_by: opts.invitedBy ?? null,
      // Already on the team — accepted_at means "staff row exists", which it
      // does. Leaving it null would list a colleague as a pending invitation.
      accepted_at: new Date().toISOString(),
    });
    if (insertError) return { status: "error", message: insertError.message };

    const tpl = staffPasswordResetTemplate({
      staffName: staff.display_name.split(" ")[0] ?? staff.display_name,
      resetUrl: await absoluteUrl(
        `/staff-invite?token=${encodeURIComponent(token)}`,
      ),
      senderName: opts.senderName,
      expiryDays: INVITE_EXPIRY_DAYS,
    });
    const sent = await sendEmail({
      to: email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
    if (sent.status === "ok") return { status: "sent", email };
    return {
      status: "error",
      message:
        sent.status === "skipped"
          ? `Email isn't configured here (${sent.reason}), so nothing was sent.`
          : sent.message,
    };
  } catch (error) {
    console.error("[issueStaffPasswordLink]", error);
    return { status: "error", message: (error as Error).message };
  }
}
