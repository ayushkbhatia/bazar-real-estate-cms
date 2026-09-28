import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mortgageConsultancyReceivedEmail,
  mortgagePreapprovalReceivedEmail,
} from "@/lib/content-assets/system-emails";
import type { RenderedEmail } from "@/lib/content-assets/system-render";
import { sendEmail, type SendEmailInput, type SendEmailResult } from "@/lib/email";
import { reportError } from "@/lib/observability";
import { DOCUMENT_SETS, type DocKind, type EmploymentType } from "../documents";

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
};

type Claimed = {
  id: string;
  request_id: string;
  kind: string;
  channel: string;
  attempts: number;
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
  if (row.channel !== "email") return { status: "skipped", reason: `${row.channel} isn't connected yet` };
  if (row.kind !== "applicant_received") return { status: "skipped", reason: `unknown kind ${row.kind}` };

  const email = await applicantReceivedEmail(deps.db, row.request_id);
  if (!email) return { status: "skipped", reason: "request not found" };

  const send = deps.send ?? sendEmail;
  const result = await send({ to: email.to, subject: email.subject, text: email.text, html: email.html });
  if (result.status === "ok") return { status: "sent", providerId: result.id };
  if (result.status === "skipped") return { status: "skipped", reason: result.reason };
  return { status: "failed", reason: result.message };
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
