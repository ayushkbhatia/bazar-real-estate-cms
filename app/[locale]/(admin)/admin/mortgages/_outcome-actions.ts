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
 * Where a Fast Pre-Approval stands, from C2 and the board (SPEC §2.4, as
 * amended by 0158): its stage, moved freely, or declined (D19), from any
 * stage. The team shares a file with the banks by hand.
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
 * decides who may (the owner or the Head) and from where (any stage; "no bank
 * made an offer" only once the team has answered), closes the file,
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

// ── Stages ───────────────────────────────────────────────────────

const moveInput = targetSchema.extend({ stageId: z.string().uuid() });

/**
 * Move a Fast Pre-Approval to a stage (0158): any stage to any other, a
 * closed or declined file included (reopened there). The database checks
 * the caller is the owner or the Head, stops the clock on a stage that
 * answers the applicant and closes the file on a closing one. Nothing is
 * sent to anyone.
 */
export async function moveStage(input: z.input<typeof moveInput>): Promise<MortgageActionResult> {
  const parsed = moveInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;
  const { error } = await s.supabase.rpc("mortgage_move_stage", {
    p_request_id: b.requestId,
    p_stage_id: b.stageId,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.stage");
  const { data: stage } = await s.supabase.from("mortgage_stages").select("name").eq("id", b.stageId).maybeSingle();
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("stage.moved", { reference: b.reference, stage: (stage as { name: string } | null)?.name ?? "" }) };
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
