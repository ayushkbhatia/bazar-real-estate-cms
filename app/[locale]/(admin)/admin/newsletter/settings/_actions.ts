"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resendSendingDomains } from "@/lib/email";
import { NEWSLETTER_SEND_ROLES } from "@/lib/newsletter/campaign";
import { domainOf, senderSettingsSchema } from "@/lib/newsletter/sender";

export type SenderActionResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * Save the newsletter's From and Reply-To.
 *
 * The From's domain must be one Resend sends from: on any other, Resend
 * refuses every message, and a newsletter would fail batch after batch with
 * the reason buried in its report. When Resend can't be asked (no key here),
 * the save goes through and says so — the check is a guard, not a gate on
 * environments that never send.
 */
export async function saveSenderSettings(raw: unknown): Promise<SenderActionResult> {
  const { supabase, user } = await requireRole(NEWSLETTER_SEND_ROLES);
  const parsed = senderSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { status: "error", message: "Fix the highlighted fields.", fieldErrors };
  }
  const next = parsed.data;

  const domains = await resendSendingDomains();
  const domain = domainOf(next.from_address);
  if (domains.status === "ok" && !domains.domains.includes(domain)) {
    const list = domains.domains.length ? domains.domains.join(", ") : "none yet";
    return {
      status: "error",
      message: `Resend can't send from ${domain} yet.`,
      fieldErrors: {
        from_address: `${domain} isn't verified in Resend, so every newsletter from it would be refused. Verified: ${list}. Add ${domain} in Resend and set its DNS records first.`,
      },
    };
  }

  const { data: before } = await supabase
    .from("newsletter_settings")
    .select("from_name, from_address, reply_to")
    .eq("id", true)
    .maybeSingle();
  const { data, error } = await supabase
    .from("newsletter_settings")
    .update({ ...next, updated_by: user.id })
    .eq("id", true)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Only admins and marketing can change the sender." };

  await logAudit({
    action: "newsletter.sender_update",
    target_kind: "newsletter_settings",
    target_id: "sender",
    before: before ?? null,
    after: next,
  });
  revalidatePath("/admin/newsletter", "layout");
  return {
    status: "ok",
    message:
      domains.status === "ok"
        ? "Saved. Newsletters now come from this sender."
        : `Saved — but Resend couldn't be asked whether ${domain} is verified here (${domains.reason}).`,
  };
}
