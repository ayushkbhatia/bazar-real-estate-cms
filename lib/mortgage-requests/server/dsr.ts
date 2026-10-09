import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mobileDigits } from "../details";
import type { MortgageStorage } from "./storage";

/**
 * Data-subject requests for the mortgage module (SPEC §8 "DSR", the PDPL), as
 * part of the platform's `/admin/dsr` tool: find a person's requests by their
 * email or UAE mobile, build their part of the access archive, or erase them.
 *
 * Service role throughout: an admin acts for the subject after checking who
 * they are, and has no mortgage role (D10).
 *
 * **Erasure deletes** (0151): the files leave the bucket first, then the
 * requests go with everything that hangs off them, the activity log included.
 * Copies a partner bank was already sent can't be recalled, so the result
 * names the banks, for the DSR record and the reply to the subject.
 */

export type MortgageSubject = { email: string; mobile?: string | null };

/** "+971 50 218 4417", "0502184417", "971502184417" → "+971502184417"; null if it isn't a UAE mobile. */
export function uaeMobileE164(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const digits = mobileDigits(raw);
  return /^5\d{8}$/.test(digits) ? `+971${digits}` : null;
}

/** The subject's requests: by email (stored lower-cased and trimmed), and by mobile when one is given. */
export async function findMortgageRequests(db: SupabaseClient, subject: MortgageSubject): Promise<{ id: string; reference: string }[]> {
  const email = subject.email.trim().toLowerCase();
  const mobile = uaeMobileE164(subject.mobile);
  const [byEmail, byMobile] = await Promise.all([
    email ? db.from("mortgage_requests").select("id, reference").eq("email", email) : Promise.resolve({ data: [], error: null }),
    mobile ? db.from("mortgage_requests").select("id, reference").eq("mobile_e164", mobile) : Promise.resolve({ data: [], error: null }),
  ]);
  if (byEmail.error) throw new Error(`mortgage subject read failed: ${byEmail.error.code}`);
  if (byMobile.error) throw new Error(`mortgage subject read failed: ${byMobile.error.code}`);
  const found = new Map<string, string>();
  for (const r of [...(byEmail.data ?? []), ...(byMobile.data ?? [])] as { id: string; reference: string }[]) found.set(r.id, r.reference);
  return [...found].map(([id, reference]) => ({ id, reference })).sort((a, b) => a.reference.localeCompare(b.reference));
}

// ── Export ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

/**
 * Everything held about the subject in these requests, for the access
 * archive: their details, consents (with the IP and browser they were given
 * from), each document's state, what was recorded from it and its files' names
 * and sizes (not the files themselves), the banks it went to and what they
 * offered, the decision, consultations, the contact log and the re-upload
 * requests. The activity log contributes its dates and kinds only. Staff are
 * not named: that's the staff's data, not the subject's.
 */
export async function mortgageExport(db: SupabaseClient, ids: readonly string[]): Promise<Row[]> {
  if (ids.length === 0) return [];
  const list = [...ids];
  const [requests, consents, documents, submissions, consultations, contacts, reuploads, events] = await Promise.all([
    db
      .from("mortgage_requests")
      .select(
        "id, reference, service, status, full_name, date_of_birth, mobile_e164, email, residency, employment_type, entry_point, property_ref, locale, site_locale, submitted_at, closed_at, decision, decline_reason, decision_message, decided_at",
      )
      .in("id", list),
    db.from("mortgage_consents").select("request_id, kind, wording_version, wording_text, given_at, withdrawn_at, ip, user_agent").in("request_id", list),
    db
      .from("mortgage_documents")
      .select(
        "request_id, kind, state, recorded, accepted_at, files:mortgage_files(original_name, mime, size_bytes, page_count, period_from, period_to, uploaded_at, state)",
      )
      .in("request_id", list),
    db
      .from("mortgage_bank_submissions")
      .select("request_id, status, sent_at, responded_at, max_amount_aed, rate_pct, rate_type, fixed_years, valid_until, bank:mortgage_partner_banks(name)")
      .in("request_id", list),
    db.from("mortgage_consultations").select("request_id, format, starts_at, ends_at, status").in("request_id", list),
    db.from("mortgage_contact_attempts").select("request_id, channel, outcome, body, duration_seconds, occurred_at").in("request_id", list),
    db.from("mortgage_reupload_requests").select("request_id, reason, message, requested_at, fulfilled_at, cancelled_at, document:mortgage_documents(kind)").in("request_id", list),
    db.from("mortgage_events").select("request_id, type, created_at").in("request_id", list).order("created_at"),
  ]);
  for (const r of [requests, consents, documents, submissions, consultations, contacts, reuploads, events]) {
    if (r.error) throw new Error(`mortgage export read failed: ${r.error.code}`);
  }

  const of = (rows: unknown, id: string) => ((rows ?? []) as Row[]).filter((r) => r.request_id === id);
  const without = (r: Row, ...keys: string[]) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k)));

  return ((requests.data ?? []) as Row[])
    .sort((a, b) => String(a.reference).localeCompare(String(b.reference)))
    .map((r) => {
      const id = String(r.id);
      return {
        reference: r.reference,
        service: r.service,
        status: r.status,
        submitted_at: r.submitted_at,
        closed_at: r.closed_at,
        applicant: {
          full_name: r.full_name,
          date_of_birth: r.date_of_birth,
          mobile: r.mobile_e164,
          email: r.email,
          residency: r.residency,
          employment_type: r.employment_type,
          language: r.locale,
          website: r.site_locale,
          started_from: r.entry_point,
          property_reference: r.property_ref,
        },
        consents: of(consents.data, id).map((c) => without(c, "request_id")),
        documents: of(documents.data, id).map((d) => ({
          ...without(d, "request_id", "files"),
          files: ((d.files ?? []) as Row[]).filter((f) => f.state !== "removed").map((f) => without(f, "state")),
        })),
        shared_with_banks: of(submissions.data, id).map((s) => ({
          bank: (s.bank as { name?: string } | null)?.name ?? null,
          ...without(s, "request_id", "bank"),
        })),
        decision: r.decision
          ? { outcome: r.decision, reason: r.decline_reason, message: r.decision_message, decided_at: r.decided_at }
          : null,
        consultations: of(consultations.data, id).map((c) => without(c, "request_id")),
        contact_log: of(contacts.data, id).map((c) => without(c, "request_id")),
        reupload_requests: of(reuploads.data, id).map((u) => ({
          document: (u.document as { kind?: string } | null)?.kind ?? null,
          ...without(u, "request_id", "document"),
        })),
        activity: of(events.data, id).map((e) => ({ type: e.type, at: e.created_at })),
      };
    });
}

/** The export itself is on each request's record: who asked is in `dsr_requests`, this says when. */
export async function logMortgageExport(db: SupabaseClient, ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    const { error } = await db.rpc("mortgage_log_event", {
      p_request_id: id,
      p_type: "dsr.exported",
      p_data: {},
      p_actor_kind: "system",
    } as never);
    if (error) throw new Error(`export log failed: ${error.code}`);
  }
}

// ── Erasure ──────────────────────────────────────────────────────

export type MortgageErasure = {
  requests: string[];
  files: number;
  events: number;
  /** Packages a bank was sent before the erasure: those copies can't be recalled. */
  shared_with_banks: { reference: string; bank: string; label: string; sent_at: string; status: string }[];
};

const NOTHING: MortgageErasure = { requests: [], files: 0, events: 0, shared_with_banks: [] };

/**
 * Erase the requests: their files from the bucket first, then the rows (0151).
 * Throws before touching a row if the bucket refuses, so a retry finds the
 * same requests and finishes the job.
 */
export async function eraseMortgageRequests(
  deps: { db: SupabaseClient; storage: MortgageStorage },
  ids: readonly string[],
): Promise<MortgageErasure> {
  if (ids.length === 0) return NOTHING;
  const { data: files, error } = await deps.db.rpc("mortgage_erasure_files", { p_request_ids: [...ids] });
  if (error) throw new Error(`erasure read failed: ${error.code}`);
  const keys = ((files ?? []) as { storage_key: string }[]).map((f) => f.storage_key);
  for (let i = 0; i < keys.length; i += 500) await deps.storage.remove(keys.slice(i, i + 500));

  const { data, error: eraseError } = await deps.db.rpc("mortgage_erase_requests", { p_request_ids: [...ids] });
  if (eraseError) throw new Error(`erasure failed: ${eraseError.code}`);
  const tally = (data ?? {}) as Partial<MortgageErasure>;
  return {
    requests: tally.requests ?? [],
    files: Number(tally.files ?? 0),
    events: Number(tally.events ?? 0),
    shared_with_banks: tally.shared_with_banks ?? [],
  };
}
