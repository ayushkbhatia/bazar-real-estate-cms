"use server";

import { after } from "next/server";
import { z } from "zod";
import { mortgageBankPackageEmail, mortgageBankReminderEmail } from "@/lib/content-assets/system-emails";
import { reportError } from "@/lib/observability";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { DECLINE_REASONS } from "@/lib/mortgage-requests/decline";
import { bankLabel, loadBanks, packageLinks, packageUrl, sendable } from "@/lib/mortgage-requests/server/banks";
import {
  FAILED,
  INVALID,
  refreshMortgagePaths,
  refused,
  sendLinkEmail,
  targetSchema,
  teamSession,
  NOT_ALLOWED,
  type MortgageActionResult,
} from "@/lib/mortgage-requests/server/cms-kit";
import { deliverNotifications } from "@/lib/mortgage-requests/server/notify";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";
import { hashToken } from "@/lib/mortgage-requests/server/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The decision (C5; SPEC §2.4). Phase 6 adds the pre-approval; D19's decline
 * comes first, from C2, for a file that isn't worth sending to the banks as
 * well as one they turned down.
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
 * bank made an offer" only once the banks were asked), stops the clock,
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

// ── Phase 6: the banks and the pre-approval ──────────────────────

/** "FAB, ADCB and Mashreq". */
function listJoin(items: readonly string[]): string {
  return new Intl.ListFormat("en-GB", { type: "conjunction" }).format(items);
}

const sendInput = targetSchema.extend({
  bankIds: z.array(z.string().uuid()).min(1).max(20),
});

/**
 * C2's "Accept application": one submission and one expiring package link per
 * chosen bank, the file to With banks (the database insists on every document
 * accepted, consent on file and at least one bank), then each bank's email.
 * The emails carry the links, so they go from here and are recorded, never
 * queued; a failed one is fixed with a reminder, which sends a fresh link.
 */
export async function acceptApplicationAndSend(input: z.input<typeof sendInput>): Promise<MortgageActionResult> {
  const parsed = sendInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const admin = createAdminClient();
  if (!admin) return FAILED;
  const b = parsed.data;

  const [{ settings }, allBanks, { data: docs }] = await Promise.all([
    loadMortgageSettings(s.supabase),
    loadBanks(s.supabase),
    s.supabase.from("mortgage_documents").select("kind").eq("request_id", b.requestId),
  ]);
  const banks = allBanks.filter((bank) => b.bankIds.includes(bank.id));
  if (banks.length !== new Set(b.bankIds).size || !banks.every(sendable)) return INVALID;

  const kinds = ((docs ?? []) as { kind: string }[]).map((d) => d.kind);
  const { links, packages } = packageLinks(
    banks.map((bank) => bank.id),
    new Date(),
    settings.link_expiry_days,
  );
  const { error } = await s.supabase.rpc("mortgage_send_to_banks", {
    p_request_id: b.requestId,
    p_packages: packages,
    p_manifest: { documents: kinds.length, kinds, summary: true },
    p_expected_updated_at: b.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.send");

  const { data: subs } = await admin
    .from("mortgage_bank_submissions")
    .select("id, bank_id")
    .eq("request_id", b.requestId);
  const submissionOf = new Map(((subs ?? []) as { id: string; bank_id: string }[]).map((x) => [x.bank_id, x.id]));
  const failed: string[] = [];
  for (const link of links) {
    const bank = banks.find((x) => x.id === link.bankId)!;
    const email = await mortgageBankPackageEmail({
      bankName: bank.name,
      reference: b.reference,
      adviserName: s.staff.display_name,
      link: packageUrl(link.token),
      expiresAt: link.expiresAt,
      documentCount: kinds.length,
    });
    let delivered = false;
    for (const [i, to] of bank.package_emails.entries()) {
      const status = await sendLinkEmail(admin, {
        requestId: b.requestId,
        kind: "bank_package",
        dedupe: `${submissionOf.get(bank.id) ?? bank.id}:${i}`,
        to,
        replyTo: s.user.email,
        email,
        whatsapp: false,
        source: "mortgage.cms.send",
      });
      delivered ||= status !== "failed";
    }
    if (!delivered) failed.push(bankLabel(bank));
  }

  refreshMortgagePaths(b.reference);
  if (failed.length) return { ok: true, message: t("c2.send.emailFailed", { bank: listJoin(failed) }) };
  return { ok: true, message: t("c2.send.done", { banks: listJoin(banks.map(bankLabel)) }) };
}

const submissionTarget = targetSchema.extend({ submissionId: z.string().uuid() });

/** "Send a reminder" (C5): a fresh package link, the old one never having been stored. */
export async function sendBankReminder(input: z.input<typeof submissionTarget>): Promise<MortgageActionResult> {
  const parsed = submissionTarget.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const admin = createAdminClient();
  if (!admin) return FAILED;
  const b = parsed.data;

  const { data: sub } = await s.supabase
    .from("mortgage_bank_submissions")
    .select("id, bank_id, sent_at, request_id")
    .eq("id", b.submissionId)
    .maybeSingle();
  const submission = sub as { id: string; bank_id: string; sent_at: string; request_id: string } | null;
  if (!submission || submission.request_id !== b.requestId) return INVALID;
  const bank = (await loadBanks(s.supabase)).find((x) => x.id === submission.bank_id);
  if (!bank) return INVALID;

  const { settings } = await loadMortgageSettings(s.supabase);
  const [link] = packageLinks([bank.id], new Date(), settings.link_expiry_days).links;
  const { error } = await s.supabase.rpc("mortgage_bank_reminder", {
    p_submission_id: submission.id,
    p_token_hash: hashToken(link!.token),
    p_expires_at: link!.expiresAt,
  });
  if (error) {
    if (error.code === "MR409" && error.message.includes("reminded_recently")) {
      return { ok: false, code: "conflict", message: t("c5.reminder.recent", { bank: bankLabel(bank) }) };
    }
    return refused(error, "mortgage.cms.reminder");
  }

  const email = await mortgageBankReminderEmail({
    bankName: bank.name,
    reference: b.reference,
    adviserName: s.staff.display_name,
    link: packageUrl(link!.token),
    expiresAt: link!.expiresAt,
    sentAt: submission.sent_at,
  });
  const stamp = new Date().toISOString();
  for (const [i, to] of bank.package_emails.entries()) {
    await sendLinkEmail(admin, {
      requestId: b.requestId,
      kind: "bank_reminder",
      dedupe: `${submission.id}:${stamp}:${i}`,
      to,
      replyTo: s.user.email,
      email,
      whatsapp: false,
      source: "mortgage.cms.reminder",
    });
  }
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("c5.reminder.sent", { bank: bankLabel(bank) }) };
}

const responseInput = submissionTarget.extend({
  status: z.enum(["pre_approved", "declined"]),
  amountAed: z.number().positive().max(100_000_000).nullable(),
  ratePct: z.number().positive().lt(30).nullable(),
  rateType: z.enum(["fixed", "variable"]).nullable(),
  fixedYears: z.number().int().min(1).max(30).nullable(),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  letterFileId: z.string().uuid().nullable(),
  notes: z.string().max(1000).optional(),
  bank: z.string().max(40),
});

/** "Record response" (C5; not designed): the bank's answer, and its letter for a pre-approval. */
export async function recordBankResponse(input: z.input<typeof responseInput>): Promise<MortgageActionResult> {
  const parsed = responseInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: t("c5.record.invalid") };
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;
  const offer = b.status === "pre_approved";
  // A decline has no offer: the function takes these nulls, though the generated types can't say so.
  const args = {
    p_submission_id: b.submissionId,
    p_status: b.status,
    p_max_amount_aed: offer ? b.amountAed : null,
    p_rate_pct: offer ? b.ratePct : null,
    p_rate_type: offer ? b.rateType : null,
    p_fixed_years: offer && b.rateType === "fixed" ? b.fixedYears : null,
    p_valid_until: offer ? b.validUntil : null,
    p_letter_file_id: b.letterFileId,
    p_notes: b.notes ?? "",
  };
  const { error } = await s.supabase.rpc("mortgage_record_bank_response", args as never);
  if (error) {
    if (error.code === "MR422" && error.message.includes("letter_not_ready")) {
      return { ok: false, code: "invalid", message: t("c5.record.needsLetter"), fields: ["letter"] };
    }
    if (error.code === "MR422") return { ok: false, code: "invalid", message: t("c5.record.invalid") };
    return refused(error, "mortgage.cms.response");
  }
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("c5.record.saved", { bank: b.bank }) };
}

const preApproveInput = targetSchema.extend({
  leadSubmissionId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  channels: z.array(z.enum(["email", "whatsapp"])).min(1).max(2),
  firstName: z.string().max(80),
});

/**
 * "Confirm pre-approval & notify" (C5): the file to Pre-approved, the clock
 * stopped, banks still deciding withdrawn, and the applicant's email — with
 * the lead bank's letter — queued and sent after the answer.
 */
export async function preApprove(input: z.input<typeof preApproveInput>): Promise<MortgageActionResult> {
  const parsed = preApproveInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: t("c5.cta.needsLead") };
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;
  const channels = b.channels.includes("email") ? b.channels : ["email", ...b.channels];
  const { error } = await s.supabase.rpc("mortgage_pre_approve", {
    p_request_id: b.requestId,
    p_lead_submission_id: b.leadSubmissionId,
    p_message: b.message,
    p_channels: channels,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) {
    if (error.code === "MR422" && error.message.includes("no_consent")) return { ok: false, code: "invalid", message: t("c5.cta.needsConsent") };
    if (error.code === "MR422" && error.message.includes("letter_not_ready")) return { ok: false, code: "invalid", message: t("c5.record.needsLetter") };
    if (error.code === "MR422") return { ok: false, code: "invalid", message: t("c5.cta.needsLead") };
    return refused(error, "mortgage.cms.preapprove");
  }
  const admin = createAdminClient();
  if (admin) {
    after(async () => {
      try {
        await deliverNotifications({ db: admin }, { requestId: b.requestId });
      } catch (e) {
        await reportError(e, { source: "mortgage.cms.preapprove.notify" });
      }
    });
  }
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("c5.done", { firstName: b.firstName }) };
}
