"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { mortgageReuploadRequestEmail } from "@/lib/content-assets/system-emails";
import { emailSiteUrl, mortgageDocumentName } from "@/lib/email-templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKLISTS } from "@/lib/mortgage-requests/checklists";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { coverage, monthBounds, monthOf } from "@/lib/mortgage-requests/coverage";
import { DOC_KINDS, requiredStatementMonths, type DocKind } from "@/lib/mortgage-requests/documents";
import { clockPause, clockResume } from "@/lib/mortgage-requests/sla";
import {
  FAILED,
  INVALID,
  NOT_ALLOWED,
  refreshMortgagePaths,
  refused,
  sendLinkEmail,
  targetSchema,
  teamSession,
  type MortgageActionResult,
} from "@/lib/mortgage-requests/server/cms-kit";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";
import { hashToken, newToken } from "@/lib/mortgage-requests/server/tokens";

/**
 * The document viewer's actions (C3/C4; SPEC §4.3 `setCheck`,
 * `setRecordedFields`, `setStatementPeriod`, `acceptDocument`,
 * `requestReupload`, `cancelReupload`). Each calls a 0145 function through
 * the reviewer's own session, so the database decides again who may act.
 */

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const UUID = z.string().uuid();
const REF = z.string().regex(/^BZM-\d{2}-\d{4,}$/);
const KIND = z.enum(DOC_KINDS);
const docTarget = z.object({ reference: REF, documentId: UUID, kind: KIND });

function refresh(reference: string, kind: DocKind) {
  refreshMortgagePaths(reference, kind);
}

/** Statements' coverage check follows the periods; nobody ticks it by hand (C4 proposal). */
const COMPUTED_CHECK = "covers_period";

function isStatement(kind: DocKind) {
  return kind === "bank_statements_3m" || kind === "bank_statements_12m";
}

export async function setDocumentCheck(
  input: z.input<typeof docTarget> & { key: string; value: boolean },
): Promise<MortgageActionResult> {
  const parsed = docTarget.extend({ key: z.string().max(40), value: z.boolean() }).safeParse(input);
  if (!parsed.success) return INVALID;
  const { kind, key } = parsed.data;
  if (!CHECKLISTS[kind].checks.some((c) => c.key === key) || (isStatement(kind) && key === COMPUTED_CHECK)) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_set_check", {
    p_document_id: parsed.data.documentId,
    p_key: key,
    p_value: parsed.data.value,
  });
  if (error) return refused(error, "mortgage.cms.check");
  refresh(parsed.data.reference, kind);
  return { ok: true };
}

/** "32,500", "AED 32500" → 32500; anything else → null. */
function aedOf(raw: string): number | null {
  const digits = raw.replace(/aed/i, "").replace(/[,\s]/g, "");
  if (!/^\d{1,9}$/.test(digits)) return null;
  const n = Number(digits);
  return n > 0 ? n : null;
}

export async function setRecordedFields(
  input: z.input<typeof docTarget> & { values: Record<string, string> },
): Promise<MortgageActionResult> {
  const parsed = docTarget.extend({ values: z.record(z.string(), z.string().max(200)) }).safeParse(input);
  if (!parsed.success) return INVALID;
  const fields = CHECKLISTS[parsed.data.kind].recorded;
  const values: Record<string, string | number | null> = {};
  const bad: string[] = [];
  for (const [key, raw] of Object.entries(parsed.data.values)) {
    const field = fields.find((f) => f.key === key);
    if (!field) return INVALID;
    const text = raw.trim();
    if (!text) {
      values[key] = null;
      continue;
    }
    if (field.type === "aed") {
      const n = aedOf(text);
      if (n === null) bad.push(key);
      else values[key] = n;
    } else if (field.type === "month") {
      const m = /^(\d{4})-(\d{2})$/.exec(text);
      const ok = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1950 && text <= new Date().toISOString().slice(0, 7);
      if (!ok) bad.push(key);
      else values[key] = text;
    } else {
      values[key] = text.slice(0, 120);
    }
  }
  if (bad.length) return { ok: false, code: "invalid", message: t("c3.invalidAed"), fields: bad };
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_set_recorded", {
    p_document_id: parsed.data.documentId,
    p_values: values,
  });
  if (error) return refused(error, "mortgage.cms.recorded");
  refresh(parsed.data.reference, parsed.data.kind);
  return { ok: true, message: t("c3.saved") };
}

const MONTH = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export async function setStatementPeriod(
  input: z.input<typeof docTarget> & { fileId: string; from: string; to: string },
): Promise<MortgageActionResult> {
  const parsed = docTarget.extend({ fileId: UUID, from: MONTH, to: MONTH }).safeParse(input);
  if (!parsed.success || !isStatement(parsed.data.kind) || parsed.data.to < parsed.data.from) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_set_statement_period", {
    p_file_id: parsed.data.fileId,
    p_from: monthBounds(parsed.data.from).first,
    p_to: monthBounds(parsed.data.to).last,
  });
  if (error) return refused(error, "mortgage.cms.period");

  // The coverage check follows: ticked when every required month is covered.
  const [{ data: files }, { data: request }] = await Promise.all([
    s.supabase.from("mortgage_files").select("period_from, period_to").eq("document_id", parsed.data.documentId).eq("state", "active"),
    s.supabase.from("mortgage_requests").select("submitted_at").eq("reference", parsed.data.reference).single(),
  ]);
  const required = requiredStatementMonths(parsed.data.kind, (request as { submitted_at: string }).submitted_at);
  const covered = coverage(
    required,
    ((files ?? []) as { period_from: string | null; period_to: string | null }[]).map((f) => ({
      from: f.period_from ? monthOf(f.period_from) : null,
      to: f.period_to ? monthOf(f.period_to) : null,
    })),
  );
  const { error: checkError } = await s.supabase.rpc("mortgage_set_check", {
    p_document_id: parsed.data.documentId,
    p_key: COMPUTED_CHECK,
    p_value: covered.complete,
  });
  if (checkError) return refused(checkError, "mortgage.cms.period");
  refresh(parsed.data.reference, parsed.data.kind);
  return { ok: true };
}

export async function acceptDocument(input: z.input<typeof docTarget>): Promise<MortgageActionResult> {
  const parsed = docTarget.safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const list = CHECKLISTS[parsed.data.kind];
  // D21: the salary certificate's figures price the file (C5), so they're required too.
  if (list.recorded.length) {
    const { data } = await s.supabase.from("mortgage_documents").select("recorded").eq("id", parsed.data.documentId).single();
    const recorded = ((data as { recorded: Record<string, unknown> | null } | null)?.recorded ?? {}) as Record<string, unknown>;
    const missing = list.recorded.filter((f) => recorded[f.key] === undefined || recorded[f.key] === null || recorded[f.key] === "");
    if (missing.length) return { ok: false, code: "invalid", message: t("c3.fieldsNeeded"), fields: missing.map((f) => f.key) };
  }
  const { error } = await s.supabase.rpc("mortgage_accept_document", {
    p_document_id: parsed.data.documentId,
    p_required_checks: list.checks.map((c) => c.key),
  });
  if (error) return refused(error, "mortgage.cms.accept");
  refresh(parsed.data.reference, parsed.data.kind);
  return { ok: true, message: t("c3.accepted") };
}

const REASONS = ["unreadable", "wrong_document", "expired", "period_incomplete", "pages_missing", "other"] as const;

const reuploadInput = targetSchema.extend({
  documentId: UUID,
  kind: KIND,
  reason: z.enum(REASONS),
  message: z.string().trim().min(1).max(1000),
  channels: z.array(z.enum(["whatsapp", "email"])).min(1).max(2),
});

type RequestClock = {
  status: string;
  updated_at: string;
  full_name: string;
  email: string;
  locale: string;
  sla_due_at: string | null;
  sla_remaining_seconds: number | null;
};

async function readClock(db: SupabaseClient, requestId: string): Promise<RequestClock | null> {
  const { data, error } = await db
    .from("mortgage_requests")
    .select("status, updated_at, full_name, email, locale, sla_due_at, sla_remaining_seconds")
    .eq("id", requestId)
    .single();
  return error ? null : (data as RequestClock);
}

/**
 * Ask the applicant for a document again (C4): the request and its secure
 * link, the pause of the promise (sla.ts's figures), then the email — sent
 * now, since only the email ever holds the link.
 */
export async function requestReupload(input: z.input<typeof reuploadInput>): Promise<MortgageActionResult> {
  const parsed = reuploadInput.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message =
      field === "reason" ? t("c4.reasonRequired") : field === "message" ? t("c4.messageRequired") : field === "channels" ? t("c4.channelRequired") : cmsT("common.failed");
    return { ok: false, code: "invalid", message, fields: field ? [String(field)] : [] };
  }
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const admin = createAdminClient();
  if (!admin) return FAILED;
  const b = parsed.data;

  let request = await readClock(s.supabase, b.requestId);
  if (!request) return FAILED;
  if (request.updated_at !== b.updatedAt) return refused({ code: "MR409", message: "" }, "mortgage.cms.reupload");
  // A reviewer can ask before the owner's first open moved the file on: that
  // move happens now, as the system's (SPEC §2.4 "Owner opens the first document").
  if (request.status === "new") {
    const { error } = await admin.rpc("mortgage_transition", {
      p_request_id: b.requestId,
      p_event: "first_document_opened",
      p_actor_kind: "system",
    });
    if (error) return refused(error, "mortgage.cms.reupload");
    request = await readClock(s.supabase, b.requestId);
    if (!request) return FAILED;
  }

  const now = new Date();
  const { policy, settings } = await loadMortgageSettings(s.supabase);
  const sla = request.sla_due_at ? clockPause(request, now, policy) : {};
  const token = newToken();
  const expiresAt = new Date(now.getTime() + settings.link_expiry_days * 86_400_000).toISOString();

  const { data, error } = await s.supabase.rpc("mortgage_request_reupload", {
    p_document_id: b.documentId,
    p_reason: b.reason,
    p_message: b.message,
    p_channels: b.channels,
    p_token_hash: hashToken(token),
    p_expires_at: expiresAt,
    p_sla: sla,
    p_expected_updated_at: request.updated_at,
  });
  if (error) return refused(error, "mortgage.cms.reupload");
  const made = data as { reupload_id: string; link_id: string };

  const email = await mortgageReuploadRequestEmail(
    {
      name: request.full_name,
      reference: b.reference,
      adviserName: s.staff.display_name,
      documentName: mortgageDocumentName(b.kind, request.locale === "ar" ? "ar" : "en"),
      message: b.message,
      link: `${emailSiteUrl()}/mortgages/r/${token}`,
      expiresAt,
    },
    request.locale === "ar" ? "ar" : "en",
  );
  // WhatsApp isn't connected (D1), so the email always goes: it is the only
  // way the link reaches the applicant. A WhatsApp choice is recorded as skipped.
  const status = await sendLinkEmail(admin, {
    requestId: b.requestId,
    kind: "reupload_request",
    dedupe: made.link_id,
    to: request.email,
    replyTo: s.user.email,
    email,
    whatsapp: b.channels.includes("whatsapp"),
    source: "mortgage.cms.reupload",
  });

  refresh(b.reference, b.kind);
  if (status === "failed") return { ok: false, code: "failed", message: t("c6.invite.emailFailed") };
  return { ok: true, message: t("c4.sent", { firstName: request.full_name.trim().split(/\s+/)[0] ?? "" }) };
}

/** Take a re-upload request back (C2): the link stops, the document is reviewable, the promise resumes. */
export async function cancelReupload(
  input: z.input<typeof targetSchema> & { reuploadId: string; kind: DocKind },
): Promise<MortgageActionResult> {
  const parsed = targetSchema.extend({ reuploadId: UUID, kind: KIND }).safeParse(input);
  if (!parsed.success) return INVALID;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const request = await readClock(s.supabase, parsed.data.requestId);
  if (!request) return FAILED;
  const { policy } = await loadMortgageSettings(s.supabase);
  const sla = request.sla_remaining_seconds !== null ? clockResume(request, new Date(), policy) : {};
  const { error } = await s.supabase.rpc("mortgage_cancel_reupload", {
    p_reupload_id: parsed.data.reuploadId,
    p_sla: sla,
    p_expected_updated_at: parsed.data.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.reupload.cancel");
  refresh(parsed.data.reference, parsed.data.kind);
  return { ok: true, message: t("c2.reupload.cancelled") };
}
