import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mortgageConsultancyReceivedEmail,
  mortgageConsultationBookedEmail,
  mortgagePreapprovalReceivedEmail,
  mortgageTeamAtRiskEmail,
  mortgageTeamBreachedEmail,
  mortgageTeamNewRequestEmail,
} from "@/lib/content-assets/system-emails";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import { sendEmail, type SendEmailInput, type SendEmailResult } from "@/lib/email";
import { emailSiteUrl } from "@/lib/email-templates";
import { reportError } from "@/lib/observability";
import { cmsT } from "../cms-strings";
import { DOCUMENT_SETS, type DocKind, type EmploymentType } from "../documents";
import { formatDayTime } from "../format";
import { consultationIcs } from "../ics";
import { formatDuration, slaStatus, type SlaFields } from "../sla";
import { loadMortgageSettings } from "./settings";

/**
 * The notification outbox (`mortgage_notifications`, 0141): sending what the
 * database queued.
 *
 * `mortgage_create_request()` queues the applicant's confirmation in the
 * transaction that creates the request. The submit route calls this for that
 * one request right after answering, and the mortgage-worker cron calls it
 * for anything still due — a failed send, or a sender that died. The claim
 * (`mortgage_claim_notifications`) is what stops the two sending one message
 * twice.
 *
 * Phase 4 adds the team's alerts — a new request, a promise at risk, a promise
 * missed — each as a bell notification and an email to the owner and the Head
 * of mortgages (`recipient_staff_id`), and the applicant's booking
 * confirmation with its calendar invite. The team's alerts name the request
 * by reference only: no applicant's name, mobile or email reaches the bell or
 * an inbox outside the CMS. WhatsApp rows are recorded as skipped until the
 * Business API is connected (decision D1).
 *
 * No personal data leaves this file except in the email itself: rows carry a
 * reason, never an address; events carry the kind and channel.
 */

/** Mirrors `mortgage_claim_notifications`: after five attempts a person looks. */
export const MAX_ATTEMPTS = 5;

export type NotifyDeps = {
  db: SupabaseClient;
  /** Defaults to lib/email's `sendEmail`; tests pass their own. */
  send?: (input: SendEmailInput) => Promise<SendEmailResult>;
  now?: () => Date;
  /** A team member's sign-in address. Defaults to Supabase Auth's admin API. */
  staffEmail?: (userId: string) => Promise<string | null>;
};

type Claimed = {
  id: string;
  request_id: string;
  kind: string;
  channel: string;
  attempts: number;
  recipient_staff_id: string | null;
  dedupe: string;
};

type Outcome =
  | { status: "sent"; providerId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export type DeliveryReport = { sent: number; skipped: number; failed: number };

/** Minutes to wait before attempt n+1: 1, 2, 4, 8. */
export function retryDelayMinutes(attempts: number): number {
  return 2 ** Math.max(0, attempts - 1);
}

/** A provider's error without anything that looks like an address, for the row. */
export function scrubReason(text: string): string {
  return text.replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[address]").slice(0, 500);
}

export async function deliverNotifications(
  deps: NotifyDeps,
  opts: { requestId?: string; limit?: number } = {},
): Promise<DeliveryReport> {
  const now = deps.now?.() ?? new Date();
  const { data, error } = await deps.db.rpc("mortgage_claim_notifications", {
    p_limit: opts.limit ?? 20,
    p_request_id: opts.requestId ?? null,
    p_at: now.toISOString(),
  });
  if (error) throw new Error(`notification claim failed: ${error.message}`);

  const report: DeliveryReport = { sent: 0, skipped: 0, failed: 0 };
  for (const row of (data as Claimed[] | null) ?? []) {
    let outcome: Outcome;
    try {
      outcome = await deliver(deps, row);
    } catch (e) {
      outcome = { status: "failed", reason: e instanceof Error ? e.message : String(e) };
    }
    await record(deps, row, outcome, now);
    report[outcome.status] += 1;
  }
  return report;
}

async function deliver(deps: NotifyDeps, row: Claimed): Promise<Outcome> {
  // D1: no WhatsApp Business API yet. The row stays as the record that one was due.
  if (row.channel === "whatsapp") return { status: "skipped", reason: "whatsapp isn't connected yet" };

  switch (row.kind) {
    case "applicant_received": {
      if (row.channel !== "email") return { status: "skipped", reason: `no ${row.channel} for ${row.kind}` };
      const email = await applicantReceivedEmail(deps.db, row.request_id);
      if (!email) return { status: "skipped", reason: "request not found" };
      return sendTo(deps, email);
    }
    case "team_new_request":
    case "team_at_risk":
    case "team_breached":
      return deliverTeamAlert(deps, row);
    case "consultation_booked": {
      if (row.channel !== "email") return { status: "skipped", reason: `no ${row.channel} for ${row.kind}` };
      const email = await consultationBookedEmail(deps, row.request_id, row.dedupe);
      if (!email) return { status: "skipped", reason: "consultation no longer booked" };
      return sendTo(deps, email);
    }
    default:
      // preapproval_invite is sent by the action that makes the link (the
      // outbox never holds its token) and recorded already sent.
      return { status: "skipped", reason: `unknown kind ${row.kind}` };
  }
}

type Addressed = RenderedEmail & { to: string; replyTo?: string; attachments?: SendEmailInput["attachments"] };

async function sendTo(deps: NotifyDeps, email: Addressed): Promise<Outcome> {
  const send = deps.send ?? sendEmail;
  const result = await send({
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    ...(email.attachments ? { attachments: email.attachments } : {}),
  });
  if (result.status === "ok") return { status: "sent", providerId: result.id };
  if (result.status === "skipped") return { status: "skipped", reason: result.reason };
  return { status: "failed", reason: result.message };
}

// ── The team's alerts ────────────────────────────────────────────

type RequestForAlert = SlaFields & {
  id: string;
  reference: string;
  service: "consultancy" | "pre_approval";
  owner_staff_id: string | null;
  submitted_at: string;
};

const BELL_KIND = {
  team_new_request: "mortgage_request",
  team_at_risk: "mortgage_at_risk",
  team_breached: "mortgage_breached",
} as const;

async function defaultStaffEmail(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error) throw new Error(`staff email lookup failed: ${error.message}`);
  return data.user?.email ?? null;
}

async function deliverTeamAlert(deps: NotifyDeps, row: Claimed): Promise<Outcome> {
  if (!row.recipient_staff_id) return { status: "skipped", reason: "no recipient" };
  const { data, error } = await deps.db
    .from("mortgage_requests")
    .select("id, reference, service, owner_staff_id, submitted_at, sla_started_at, sla_due_at, sla_paused_at, sla_remaining_seconds, sla_stopped_at")
    .eq("id", row.request_id)
    .maybeSingle();
  if (error) throw new Error(`request read failed: ${error.message}`);
  const r = data as RequestForAlert | null;
  if (!r) return { status: "skipped", reason: "request not found" };

  const path = `/admin/mortgages/${r.reference}`;
  let title: string;
  let body: string | null = null;
  let email: () => Promise<RenderedEmail>;
  const alert = { reference: r.reference, service: r.service, link: `${emailSiteUrl()}${path}` };

  if (row.kind === "team_new_request") {
    title = cmsT("notify.newRequest", {
      service: r.service === "pre_approval" ? cmsT("service.preApproval") : cmsT("service.consultancy"),
      reference: r.reference,
    });
    const owner = r.owner_staff_id ? await staffName(deps.db, r.owner_staff_id) : null;
    email = () => mortgageTeamNewRequestEmail({ ...alert, submittedAt: r.submitted_at, ownerName: owner });
  } else {
    // A warning about a promise that has since stopped or paused is noise.
    if (r.sla_stopped_at || r.sla_paused_at || !r.sla_due_at) {
      return { status: "skipped", reason: "the promise is no longer running" };
    }
    const dueAt = r.sla_due_at;
    if (row.kind === "team_at_risk") {
      const { policy } = await loadMortgageSettings(deps.db);
      const status = slaStatus(r, deps.now?.() ?? new Date(), policy);
      const remainingSeconds = Math.max(0, status.remainingSeconds ?? 0);
      title = cmsT("notify.atRisk", { reference: r.reference });
      body = cmsT("notify.atRiskBody", { remaining: formatDuration(remainingSeconds), dueAt: formatDayTime(dueAt) });
      email = () => mortgageTeamAtRiskEmail({ ...alert, remainingSeconds, dueAt });
    } else {
      title = cmsT("notify.breached", { reference: r.reference });
      body = cmsT("notify.breachedBody", { dueAt: formatDayTime(dueAt) });
      email = () => mortgageTeamBreachedEmail({ ...alert, dueAt });
    }
  }

  if (row.channel === "in_app") {
    const { data: bell, error: bellError } = await deps.db
      .from("notifications")
      .insert({
        user_id: row.recipient_staff_id,
        kind: BELL_KIND[row.kind as keyof typeof BELL_KIND],
        title,
        body,
        link: path,
        payload: { reference: r.reference },
      })
      .select("id")
      .single();
    if (bellError) throw new Error(`bell insert failed: ${bellError.message}`);
    return { status: "sent", providerId: (bell as { id: string }).id };
  }
  if (row.channel !== "email") return { status: "skipped", reason: `no ${row.channel} for ${row.kind}` };

  const to = await (deps.staffEmail ?? ((id) => defaultStaffEmail(deps.db, id)))(row.recipient_staff_id);
  if (!to) return { status: "skipped", reason: "the recipient has no email" };
  return sendTo(deps, { to, ...(await email()) });
}

async function staffName(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from("staff").select("display_name").eq("user_id", userId).maybeSingle();
  return (data as { display_name: string } | null)?.display_name ?? null;
}

// ── The applicant's booking confirmation ─────────────────────────

type ConsultationForEmail = {
  id: string;
  request_id: string;
  adviser_staff_id: string;
  format: "phone" | "video" | "office";
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
};

const FORMAT_KEY = { phone: "format.phone", video: "format.video", office: "format.office" } as const;

/**
 * The booking confirmation with its .ics (C6), or null when the consultation
 * is no longer booked. Replies go to the adviser: the email tells the
 * applicant to reply if the time doesn't suit.
 */
async function consultationBookedEmail(deps: NotifyDeps, requestId: string, consultationId: string): Promise<Addressed | null> {
  const db = deps.db;
  const [request, consultation] = await Promise.all([
    db.from("mortgage_requests").select("reference, full_name, email, locale").eq("id", requestId).maybeSingle(),
    db
      .from("mortgage_consultations")
      .select("id, request_id, adviser_staff_id, format, starts_at, ends_at, duration_minutes, status")
      .eq("id", consultationId)
      .maybeSingle(),
  ]);
  if (request.error) throw new Error(`request read failed: ${request.error.message}`);
  if (consultation.error) throw new Error(`consultation read failed: ${consultation.error.message}`);
  const r = request.data as { reference: string; full_name: string; email: string; locale: string } | null;
  const c = consultation.data as ConsultationForEmail | null;
  if (!r || !c || c.request_id !== requestId || c.status !== "booked") return null;

  // An empty name lets the email use its own fallback ("Bazar's mortgage team").
  const [adviserName, adviserEmail] = await Promise.all([
    staffName(db, c.adviser_staff_id),
    (deps.staffEmail ?? ((id) => defaultStaffEmail(db, id)))(c.adviser_staff_id).catch(() => null),
  ]);
  const format = cmsT(FORMAT_KEY[c.format]);
  const rendered = await mortgageConsultationBookedEmail(
    {
      name: r.full_name,
      reference: r.reference,
      startsAt: c.starts_at,
      durationMinutes: c.duration_minutes,
      format: c.format,
      adviserName: adviserName ?? "",
    },
    r.locale === "ar" ? "ar" : "en",
  );
  const ics = consultationIcs({
    uid: c.id,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    summary: cmsT("ics.summary"),
    description: cmsT("ics.description", { format, adviser: adviserName ?? "Bazar", reference: r.reference }),
    location: format,
  });
  return {
    to: r.email,
    ...(adviserEmail ? { replyTo: adviserEmail } : {}),
    ...rendered,
    attachments: [{ filename: "bazar-consultation.ics", content: ics, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }],
  };
}

type RequestForEmail = {
  id: string;
  reference: string;
  service: "consultancy" | "pre_approval";
  full_name: string;
  email: string;
  submitted_at: string;
  sla_due_at: string | null;
  locale: string;
  employment_type: EmploymentType;
};

/** The confirmation for either service (SPEC §6), addressed. */
async function applicantReceivedEmail(
  db: SupabaseClient,
  requestId: string,
): Promise<(RenderedEmail & { to: string }) | null> {
  const { data, error } = await db
    .from("mortgage_requests")
    .select("id, reference, service, full_name, email, submitted_at, sla_due_at, locale, employment_type")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(`request read failed: ${error.message}`);
  const r = data as RequestForEmail | null;
  if (!r) return null;

  const locale = r.locale === "ar" ? "ar" : "en";
  const base = { name: r.full_name, reference: r.reference, submittedAt: r.submitted_at };
  if (r.service === "consultancy") {
    return { to: r.email, ...(await mortgageConsultancyReceivedEmail(base, locale)) };
  }
  if (!r.sla_due_at) throw new Error("a pre-approval without a due time");
  const documents = await documentsReceived(db, r.id, r.employment_type);
  return {
    to: r.email,
    ...(await mortgagePreapprovalReceivedEmail({ ...base, dueAt: r.sla_due_at, documents }, locale)),
  };
}

/** Each document with its number of files, in the order W7 lists them. */
async function documentsReceived(
  db: SupabaseClient,
  requestId: string,
  employment: EmploymentType,
): Promise<{ kind: DocKind; files: number }[]> {
  const { data: docs, error } = await db
    .from("mortgage_documents")
    .select("id, kind")
    .eq("request_id", requestId);
  if (error) throw new Error(`documents read failed: ${error.message}`);
  const rows = (docs as { id: string; kind: DocKind }[] | null) ?? [];
  const ids = rows.map((d) => d.id);
  const { data: files, error: filesError } = ids.length
    ? await db.from("mortgage_files").select("document_id").in("document_id", ids).eq("state", "active")
    : { data: [], error: null };
  if (filesError) throw new Error(`files read failed: ${filesError.message}`);
  const counts = new Map<string, number>();
  for (const f of (files as { document_id: string }[] | null) ?? []) {
    counts.set(f.document_id, (counts.get(f.document_id) ?? 0) + 1);
  }
  const order = DOCUMENT_SETS[employment];
  return rows
    .map((d) => ({ kind: d.kind, files: counts.get(d.id) ?? 0 }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

async function record(deps: NotifyDeps, row: Claimed, outcome: Outcome, now: Date): Promise<void> {
  const at = now.toISOString();
  const giveUp = outcome.status === "failed" && row.attempts >= MAX_ATTEMPTS;
  const patch =
    outcome.status === "sent"
      ? { status: "sent", sent_at: at, provider_id: outcome.providerId, last_error: null }
      : outcome.status === "skipped"
        ? { status: "skipped", last_error: scrubReason(outcome.reason) }
        : {
            status: "failed",
            last_error: scrubReason(outcome.reason),
            next_attempt_at: new Date(now.getTime() + retryDelayMinutes(row.attempts) * 60_000).toISOString(),
          };
  const { error } = await deps.db
    .from("mortgage_notifications")
    .update(patch)
    .eq("id", row.id)
    .eq("status", "sending");
  if (error) {
    await reportError(error, { source: "mortgage.notify", context: { notificationId: row.id } });
    return;
  }

  // The activity log shows that the applicant was (or wasn't) emailed.
  if (outcome.status !== "failed" || giveUp) {
    await deps.db.from("mortgage_events").insert({
      request_id: row.request_id,
      actor_kind: "system",
      type: `notification.${outcome.status}`,
      data: { kind: row.kind, channel: row.channel },
      created_at: at,
    });
  }
  if (giveUp) {
    await reportError(new Error("mortgage notification gave up after five attempts"), {
      source: "mortgage.notify",
      context: { notificationId: row.id, requestId: row.request_id, kind: row.kind },
    });
  }
}
