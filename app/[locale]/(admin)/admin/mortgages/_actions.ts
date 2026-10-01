"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { mortgagePreapprovalInviteEmail } from "@/lib/content-assets/system-emails";
import { emailSiteUrl } from "@/lib/email-templates";
import { reportError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { detailsSchema, RESIDENCIES, toE164 } from "@/lib/mortgage-requests/details";
import { dubaiDateKey, dubaiDayStart, dubaiWeekday } from "@/lib/mortgage-requests/dubai-time";
import { DEFAULT_QUEUE_PARAMS, parseQueueParams, type QueueParams } from "@/lib/mortgage-requests/queue";
import { slotsForDay, windowsFromAdviserHours, windowsFromSetting } from "@/lib/mortgage-requests/slots";
import {
  FAILED,
  INVALID,
  NOT_ALLOWED,
  refreshMortgagePaths as refresh,
  refused,
  sendLinkEmail,
  targetSchema as target,
  teamSession as team,
  type MortgageActionResult,
  type Target,
} from "@/lib/mortgage-requests/server/cms-kit";
import { listQueue, loadAdviserCalendar, type QueueResult } from "@/lib/mortgage-requests/server/cms-queries";
import { deliverNotifications } from "@/lib/mortgage-requests/server/notify";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";
import { hashToken, newToken } from "@/lib/mortgage-requests/server/tokens";

/**
 * The mortgage team's actions (docs/mortgage SPEC §4.3; cms/00-foundations §8).
 *
 * Each one runs through the caller's own session: the database function it
 * calls (0143) checks their mortgage role and ownership again, takes the
 * optimistic-concurrency check against the `updated_at` the page loaded, moves
 * status only through `mortgage_transition()` and writes the event — so a
 * forged call gets exactly what the UI would have refused. Refusals come back
 * as a result, never a thrown error, and carry no personal data.
 */

export type { MortgageActionResult } from "@/lib/mortgage-requests/server/cms-kit";

const UUID = z.string().uuid();

// ── C1 · the queue ───────────────────────────────────────────────

/**
 * The queue for a view and a search (C1 polls with this, and searches with
 * it: the search text never goes into the URL, since it can be a name).
 */
export async function loadQueue(
  params: Partial<QueueParams>,
  q: string,
): Promise<{ ok: true; result: QueueResult } | { ok: false }> {
  const s = await team();
  if (!s) return { ok: false };
  try {
    const view = parseQueueParams({
      tab: params.tab ?? DEFAULT_QUEUE_PARAMS.tab,
      service: params.service ?? DEFAULT_QUEUE_PARAMS.service,
      owner: params.owner ?? DEFAULT_QUEUE_PARAMS.owner,
      page: String(params.page ?? 1),
      risk: params.risk ? "1" : undefined,
    });
    const { policy } = await loadMortgageSettings(s.supabase);
    const result = await listQueue(s.supabase, { ...view, q: String(q ?? "").slice(0, 100) }, {
      now: new Date(),
      meId: s.user.id,
      policy,
    });
    return { ok: true, result };
  } catch (error) {
    await reportError(error, { source: "mortgage.cms.queue" });
    return { ok: false };
  }
}

// ── Owner ────────────────────────────────────────────────────────

export async function claimRequest(input: Target): Promise<MortgageActionResult> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await team();
  if (!s) return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_claim", {
    p_request_id: parsed.data.requestId,
    p_expected_updated_at: parsed.data.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.claim");
  refresh(parsed.data.reference);
  return { ok: true };
}

export async function reassignRequest(input: Target & { ownerId: string }): Promise<MortgageActionResult> {
  const parsed = target.extend({ ownerId: UUID }).safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await team();
  if (!s || s.role !== "head") return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_reassign", {
    p_request_id: parsed.data.requestId,
    p_owner: parsed.data.ownerId,
    p_expected_updated_at: parsed.data.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.reassign");
  refresh(parsed.data.reference);
  return { ok: true };
}

// ── Applicant ────────────────────────────────────────────────────

const editable = detailsSchema().omit({ employmentType: true });

export async function editApplicant(
  input: Target & { fullName: string; dateOfBirth: string; mobileNational: string; email: string; residency: string },
): Promise<MortgageActionResult> {
  const parsedTarget = target.safeParse(input);
  if (!parsedTarget.success || !RESIDENCIES.includes(input.residency as (typeof RESIDENCIES)[number])) return INVALID;
  const details = editable.safeParse({
    residency: input.residency,
    fullName: String(input.fullName ?? ""),
    dateOfBirth: String(input.dateOfBirth ?? ""),
    mobile: toE164(String(input.mobileNational ?? "")) ?? "",
    email: String(input.email ?? ""),
  });
  if (!details.success) {
    return {
      ok: false,
      code: "invalid",
      message: cmsT("edit.invalid"),
      fields: [...new Set(details.error.issues.map((i) => String(i.path[0])))],
    };
  }
  const s = await team();
  if (!s) return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_edit_applicant", {
    p_request_id: parsedTarget.data.requestId,
    p_full_name: details.data.fullName,
    p_date_of_birth: details.data.dateOfBirth,
    p_mobile_e164: details.data.mobile,
    p_email: details.data.email,
    p_residency: details.data.residency,
    p_expected_updated_at: parsedTarget.data.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.edit");
  refresh(parsedTarget.data.reference);
  return { ok: true };
}

// ── C6 · contact and booking ─────────────────────────────────────

export async function logContactAttempt(
  input: Target & { outcome: "reached" | "no_answer" | "left_message" },
): Promise<MortgageActionResult> {
  const parsed = target.extend({ outcome: z.enum(["reached", "no_answer", "left_message"]) }).safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await team();
  if (!s) return NOT_ALLOWED;
  // The three designed buttons are a call's outcomes (C6; the channel picker isn't designed).
  const { error } = await s.supabase.rpc("mortgage_log_contact", {
    p_request_id: parsed.data.requestId,
    p_channel: "call",
    p_outcome: parsed.data.outcome,
    p_expected_updated_at: parsed.data.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.contact");
  refresh(parsed.data.reference);
  return { ok: true, message: cmsT("c6.log.logged") };
}

const booking = target.extend({
  adviserId: UUID,
  format: z.enum(["phone", "video", "office"]),
  startsAt: z.string().datetime({ offset: true }),
  invite: z.boolean(),
});

export async function bookConsultation(input: z.input<typeof booking>): Promise<MortgageActionResult> {
  const parsed = booking.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await team();
  if (!s) return NOT_ALLOWED;
  const b = parsed.data;

  // The database holds the slot against double booking; this holds it to the
  // adviser's working hours, which a forged call could otherwise step outside.
  const now = new Date();
  const [{ settings, holidays }, calendar] = await Promise.all([
    loadMortgageSettings(s.supabase),
    loadAdviserCalendar(s.supabase, [b.adviserId], now),
  ]);
  const startMs = new Date(b.startsAt).getTime();
  const dayStart = dubaiDayStart(startMs);
  const weekday = dubaiWeekday(dayStart);
  const windows = windowsFromAdviserHours(calendar.hours[b.adviserId] ?? [], weekday) ?? windowsFromSetting(settings.working_hours, weekday);
  const offered = slotsForDay({
    day: dubaiDateKey(dayStart),
    windows,
    holidays: new Set(holidays.map((h) => h.day)),
    bookings: calendar.bookings[b.adviserId] ?? [],
    gridMinutes: settings.slot_grid_minutes,
    durationMinutes: settings.consultation_minutes,
    now,
  });
  const slot = offered.find((x) => new Date(x.startsAt).getTime() === startMs);
  if (!slot) return { ok: false, code: "invalid", message: cmsT("c6.book.passed") };
  if (!slot.available) return { ok: false, code: "slot_taken", message: cmsT("c6.book.taken") };

  const { error } = await s.supabase.rpc("mortgage_book_consultation", {
    p_request_id: b.requestId,
    p_adviser: b.adviserId,
    p_format: b.format,
    p_starts_at: slot.startsAt,
    p_send_invite: b.invite,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.book");

  // The confirmation and its .ics go out after the answer; the worker retries a failure.
  if (b.invite) {
    const admin = createAdminClient();
    if (admin) {
      after(async () => {
        try {
          await deliverNotifications({ db: admin }, { requestId: b.requestId });
        } catch (e) {
          await reportError(e, { source: "mortgage.cms.book.notify" });
        }
      });
    }
  }
  refresh(b.reference);
  return { ok: true };
}

export async function markConsultationHeld(input: Target): Promise<MortgageActionResult> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await team();
  if (!s) return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_consultation_held", {
    p_request_id: parsed.data.requestId,
    p_expected_updated_at: parsed.data.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.held");
  refresh(parsed.data.reference);
  return { ok: true };
}

/**
 * "Send pre-approval link" (C6): a new invite link, sent to the applicant by
 * email now. The token exists only here and in the email — the database keeps
 * its hash — so it can't wait in the outbox; the outbox gets the record of
 * what happened instead, and a failed send is retried by sending a new link.
 * The landing page behind the link is Phase 5's.
 */
export async function sendPreapprovalInvite(input: Target): Promise<MortgageActionResult> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await team();
  if (!s) return NOT_ALLOWED;
  const admin = createAdminClient();
  if (!admin) return FAILED;

  const { settings } = await loadMortgageSettings(s.supabase);
  const token = newToken();
  const expiresAt = new Date(Date.now() + settings.link_expiry_days * 86_400_000).toISOString();
  const { data: link, error } = await s.supabase.rpc("mortgage_create_invite", {
    p_request_id: parsed.data.requestId,
    p_token_hash: hashToken(token),
    p_expires_at: expiresAt,
    p_expected_updated_at: parsed.data.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.invite");
  const linkId = (link as { id: string }).id;

  const { data: r, error: readError } = await admin
    .from("mortgage_requests")
    .select("reference, full_name, email, locale")
    .eq("id", parsed.data.requestId)
    .single();
  if (readError) return FAILED;
  const request = r as { reference: string; full_name: string; email: string; locale: string };
  const email = await mortgagePreapprovalInviteEmail(
    {
      name: request.full_name,
      reference: request.reference,
      adviserName: s.staff.display_name,
      link: `${emailSiteUrl()}/mortgages/r/${token}`,
      expiresAt,
    },
    request.locale === "ar" ? "ar" : "en",
  );
  const status = await sendLinkEmail(admin, {
    requestId: parsed.data.requestId,
    kind: "preapproval_invite",
    dedupe: linkId,
    to: request.email,
    // A reply reaches the adviser who sent the link.
    replyTo: s.user.email,
    email,
    whatsapp: true,
    source: "mortgage.cms.invite",
  });

  refresh(parsed.data.reference);
  if (status === "failed") return { ok: false, code: "failed", message: cmsT("c6.invite.emailFailed") };
  // Email switched off (locally, a dry run): the link exists, but nobody has it (SR-25).
  if (status === "skipped") {
    const firstName = request.full_name.trim().split(/\s+/)[0] ?? "";
    return { ok: true, warning: true, message: cmsT("c6.invite.emailSkipped", { firstName }) };
  }
  return { ok: true };
}

// ── Settings (the Head of mortgages) ─────────────────────────────

const settingsInput = z.object({
  flag: z.enum(["off", "staff", "public"]),
  assignmentMode: z.enum(["round_robin", "claim"]),
  ltvNational: z.number().int().min(1).max(100),
  ltvExpat: z.number().int().min(1).max(100),
});

export async function updateMortgageSettings(input: z.input<typeof settingsInput>): Promise<MortgageActionResult> {
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await team();
  if (!s || s.role !== "head") return NOT_ALLOWED;
  const { settings: before } = await loadMortgageSettings(s.supabase);
  const { error } = await s.supabase.rpc("mortgage_update_settings", {
    p_flag: parsed.data.flag,
    p_assignment_mode: parsed.data.assignmentMode,
    p_ltv_national: parsed.data.ltvNational,
    p_ltv_expat: parsed.data.ltvExpat,
  });
  if (error) return refused(error, "mortgage.cms.settings");
  await logAudit({
    action: "mortgage.settings.update",
    target_kind: "mortgage_settings",
    // The singleton row's own id (`mortgage_settings.id`, always 1).
    target_id: "1",
    before: { flag: before.flag, assignment_mode: before.assignment_mode, ltv_national_pct: before.ltv_national_pct, ltv_expat_pct: before.ltv_expat_pct },
    after: { flag: parsed.data.flag, assignment_mode: parsed.data.assignmentMode, ltv_national_pct: parsed.data.ltvNational, ltv_expat_pct: parsed.data.ltvExpat },
  });
  revalidatePath("/admin/mortgages/settings");
  // The entry points follow the flag (SPEC §4.1). Only the two prerendered
  // pages that carry one are refreshed now — the listing pages pick it up at
  // their next revalidation — rather than every page's cache at once.
  if (before.flag !== parsed.data.flag) {
    revalidateLocalised("/");
    revalidateLocalised("/tools/mortgage");
  }
  return { ok: true, message: cmsT("settings.saved") };
}

const holidayInput = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().max(80),
  remove: z.boolean(),
});

export async function setMortgageHoliday(input: z.input<typeof holidayInput>): Promise<MortgageActionResult> {
  const parsed = holidayInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await team();
  if (!s || s.role !== "head") return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_set_holiday", {
    p_day: parsed.data.day,
    p_name: parsed.data.name,
    p_remove: parsed.data.remove,
  });
  if (error) return refused(error, "mortgage.cms.holiday");
  await logAudit({
    action: parsed.data.remove ? "mortgage.holiday.remove" : "mortgage.holiday.set",
    target_kind: "mortgage_holidays",
    // A holiday's key is its day.
    target_id: parsed.data.day,
    after: { day: parsed.data.day, ...(parsed.data.remove ? {} : { name: parsed.data.name }) },
  });
  revalidatePath("/admin/mortgages", "layout");
  return { ok: true, message: cmsT("settings.saved") };
}
