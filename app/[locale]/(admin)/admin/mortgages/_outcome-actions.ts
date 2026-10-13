"use server";

import { after } from "next/server";
import { z } from "zod";
import { reportError } from "@/lib/observability";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { DECLINE_REASONS } from "@/lib/mortgage-requests/decline";
import {
  INVALID,
  refreshMortgagePaths,
  refused,
  targetSchema,
  teamSession,
  NOT_ALLOWED,
  type MortgageActionResult,
} from "@/lib/mortgage-requests/server/cms-kit";
import { deliverNotifications } from "@/lib/mortgage-requests/server/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The answer to a Fast Pre-Approval, all from C2 and the board (SPEC §2.4, as
 * amended by 0156): accept the application, then record the outcome — pre-
 * approved, or declined (D19), which can also come before it is accepted.
 * The team shares an accepted file with the banks by hand.
 */

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const declineInput = targetSchema.extend({
  reason: z.enum(DECLINE_REASONS),
  message: z.string().trim().min(1).max(4000),
  channels: z.array(z.enum(["email", "whatsapp"])).min(1).max(2),
  firstName: z.string().max(80),
});

/**
 * Decline a Fast Pre-Approval, through the adviser's own session: the database
 * decides who may (the owner or the Head) and from where (any open status; "no
 * bank made an offer" only once the file was accepted), closes the file,
 * cancels an open re-upload and queues the applicant's email. It goes after
 * the answer; the worker retries a failure.
 */
export async function declineApplication(input: z.input<typeof declineInput>): Promise<MortgageActionResult> {
  const parsed = declineInput.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const firstName = typeof input.firstName === "string" ? input.firstName : "";
    const message =
      field === "reason"
        ? t("decline.reasonRequired")
        : field === "message"
          ? t("decline.messageRequired", { firstName })
          : cmsT("common.failed");
    return { ok: false, code: "invalid", message, fields: field ? [field] : [] };
  }
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;

  // Email always goes: until WhatsApp is connected (D1) it's the only way the message arrives.
  const channels = b.channels.includes("email") ? b.channels : ["email", ...b.channels];
  const { error } = await s.supabase.rpc("mortgage_decline", {
    p_request_id: b.requestId,
    p_reason: b.reason,
    p_message: b.message,
    p_channels: channels,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) {
    if (error.code === "MR422" && error.message.includes("no_bank_offer")) {
      return { ok: false, code: "invalid", message: t("decline.noBankOfferTooEarly"), fields: ["reason"] };
    }
    return refused(error, "mortgage.cms.decline");
  }

  const admin = createAdminClient();
  if (admin) {
    after(async () => {
      try {
        await deliverNotifications({ db: admin }, { requestId: b.requestId });
      } catch (e) {
        await reportError(e, { source: "mortgage.cms.decline.notify" });
      }
    });
  }
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("decline.done", { firstName: b.firstName }) };
}

// ── Accepting and the outcome ────────────────────────────────────

const acceptInput = targetSchema.extend({ firstName: z.string().max(80) });

/**
 * C2's "Accept application": every document accepted and consent on file (the
 * database checks both, and that the caller is the owner or the Head). The
 * file is Accepted and the 24-hour clock stops; the team then shares it with
 * the banks itself (0156). Nothing is sent to anyone.
 */
export async function acceptApplication(input: z.input<typeof acceptInput>): Promise<MortgageActionResult> {
  const parsed = acceptInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;
  const { error } = await s.supabase.rpc("mortgage_accept_application", {
    p_request_id: b.requestId,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) {
    if (error.code === "MR422" && error.message.includes("consent")) {
      return { ok: false, code: "invalid", message: t("c2.accept.needsConsent") };
    }
    if (error.code === "MR422") return { ok: false, code: "invalid", message: t("c2.accept.needsDocuments") };
    return refused(error, "mortgage.cms.accept");
  }
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("c2.accept.done", { firstName: b.firstName }) };
}

const preApprovalInput = targetSchema.extend({
  note: z.string().trim().max(1000).optional(),
  firstName: z.string().max(80),
});

/**
 * "Mark pre-approved": the outcome of an accepted file, once a bank has said
 * yes. It closes the file; the clock stays stopped at the acceptance. No email
 * goes — the adviser tells the applicant.
 */
export async function recordPreApproval(input: z.input<typeof preApprovalInput>): Promise<MortgageActionResult> {
  const parsed = preApprovalInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;
  const { error } = await s.supabase.rpc("mortgage_record_pre_approval", {
    p_request_id: b.requestId,
    p_note: b.note || undefined,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.preapprove");
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("c2.preApproved.done", { firstName: b.firstName }) };
}

const withdrawInput = targetSchema.extend({ firstName: z.string().max(80) });

/**
 * "Record a withdrawal" (C2's Consent card; not designed — SECURITY-REVIEW
 * SR-17): the applicant asked Bazar to stop sharing their documents with
 * partner banks. The database records it (the owner or the Head); a file
 * can't be accepted without consent on file. It can't be undone here.
 */
export async function withdrawConsent(input: z.input<typeof withdrawInput>): Promise<MortgageActionResult> {
  const parsed = withdrawInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;
  const { error } = await s.supabase.rpc("mortgage_withdraw_consent", {
    p_request_id: b.requestId,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) {
    if (error.code === "MR409" && error.message.includes("no consent")) {
      return { ok: false, code: "conflict", message: t("c2.consent.withdraw.none") };
    }
    return refused(error, "mortgage.cms.consent");
  }
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("c2.consent.withdraw.done", { firstName: b.firstName }) };
}
