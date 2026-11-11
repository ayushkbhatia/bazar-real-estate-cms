"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resendSendingDomains } from "@/lib/email";
import { NEWSLETTER_SEND_ROLES } from "@/lib/newsletter/campaign";
import { env } from "@/lib/env";
import {
  domainOf,
  isOwnSender,
  ownSenderDomains,
  ownVerifiedDomains,
  senderSettingsSchema,
} from "@/lib/newsletter/sender";

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

  const domain = domainOf(next.from_address);
  // The Resend account also sends for other sites, and the delivery webhook
  // ignores their events: a newsletter from one of their domains would never
  // learn of a bounce. Checked even when Resend can't be asked.
  const own = ownSenderDomains(env.RESEND_FROM_ADDRESS);
  if (!isOwnSender(domain, own)) {
    return {
      status: "error",
      message: `${domain} isn't one of Bazar's sending domains.`,
      fieldErrors: {
        from_address: `Newsletters must come from ${own.join(" or ")} (or a subdomain). The Resend account sends for other sites too, and their domains can't be used here.`,
      },
    };
  }

  const resend = await resendSendingDomains();
  const domains =
    resend.status === "ok"
      ? { status: "ok" as const, domains: ownVerifiedDomains(resend.domains, env.RESEND_FROM_ADDRESS) }
      : resend;
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
