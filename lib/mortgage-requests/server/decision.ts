import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { offerMonthlyPayment } from "../payments";
import { bankLabel, BANK_COLUMNS, type BankRow } from "./banks";
import { getRequestFile, type RequestFile } from "./cms-queries";
import type { MortgageSettings } from "./settings";
import type { SlaPolicy } from "../sla";

/**
 * C5 · Decision (docs/mortgage/cms/C5-decision): the file as C2 reads it,
 * plus each bank's submission with its offer and letter, the three status
 * tiles and the basis the offers were priced on. Read through the adviser's
 * own session: the team's read policies apply.
 */

export type Offer = {
  amountAed: number;
  ratePct: number;
  rateType: "fixed" | "variable";
  fixedYears: number | null;
  /** "YYYY-MM-DD". */
  validUntil: string;
  /** Over 25 years (C5), computed with payments.ts, never stored. */
  monthlyAed: number;
  /** Past its validity in Dubai today: it can't lead. */
  expired: boolean;
};

export type SubmissionView = {
  id: string;
  bank: { id: string; code: string; name: string; label: string; color: string | null };
  status: "sent" | "pre_approved" | "declined" | "withdrawn";
  sentAt: string;
  respondedAt: string | null;
  reminderSentAt: string | null;
  offer: Offer | null;
  letter: { id: string; name: string; sizeBytes: number } | null;
  notes: string | null;
};

export type DecisionData = {
  file: RequestFile;
  submissions: SubmissionView[];
  tiles: {
    accepted: number;
    total: number;
    lastAccepted: { name: string; at: string } | null;
    consentGivenAt: string | null;
    sentCount: number;
    sentAt: string | null;
  };
  /** What the offers were priced on (C5's footer line). */
  basis: { kind: "salary"; salaryAed: number } | { kind: "business" } | { kind: "none" };
  ltvPct: number;
  leadSubmissionId: string | null;
};

type SubmissionDb = {
  id: string;
  bank_id: string;
  status: SubmissionView["status"];
  sent_at: string;
  responded_at: string | null;
  reminder_sent_at: string | null;
  max_amount_aed: number | null;
  rate_pct: number | null;
  rate_type: "fixed" | "variable" | null;
  fixed_years: number | null;
  valid_until: string | null;
  notes: string | null;
};

/** Today's date in Dubai, "YYYY-MM-DD": offers are valid through the day. */
export function dubaiToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function getDecision(
  db: SupabaseClient,
  reference: string,
  ctx: { now: Date; me: { id: string; role: "head" | "adviser" }; policy: SlaPolicy; settings: MortgageSettings },
): Promise<DecisionData | null> {
  const file = await getRequestFile(db, reference, ctx);
  if (!file || file.service !== "pre_approval") return null;

  const [subs, banks, letters, accepted, consent, request] = await Promise.all([
    db
      .from("mortgage_bank_submissions")
      .select("id, bank_id, status, sent_at, responded_at, reminder_sent_at, max_amount_aed, rate_pct, rate_type, fixed_years, valid_until, notes")
      .eq("request_id", file.id)
      .order("sent_at"),
    db.from("mortgage_partner_banks").select(BANK_COLUMNS),
    db
      .from("mortgage_files")
      .select("id, bank_submission_id, original_name, size_bytes, uploaded_at")
      .not("bank_submission_id", "is", null)
      .eq("state", "active")
      .eq("scan_status", "clean"),
    db
      .from("mortgage_documents")
      .select("accepted_by, accepted_at")
      .eq("request_id", file.id)
      .eq("state", "accepted")
      .order("accepted_at", { ascending: false })
      .limit(1),
    db.from("mortgage_consents").select("given_at").eq("request_id", file.id).is("withdrawn_at", null).maybeSingle(),
    db.from("mortgage_requests").select("lead_bank_submission_id").eq("id", file.id).single(),
  ]);
  if (subs.error) throw new Error(`submissions read failed: ${subs.error.message}`);

  const bankById = new Map(((banks.data ?? []) as BankRow[]).map((b) => [b.id, b]));
  // In the team's order of banks (C5 lists FAB, ADCB, Mashreq), not the order the packages went.
  const place = (s: SubmissionDb) => bankById.get(s.bank_id)?.sort_order ?? Number.MAX_SAFE_INTEGER;
  const subRows = ((subs.data ?? []) as SubmissionDb[]).sort(
    (a, b) => place(a) - place(b) || (bankById.get(a.bank_id)?.name ?? "").localeCompare(bankById.get(b.bank_id)?.name ?? ""),
  );
  const ids = new Set(subRows.map((s) => s.id));
  const letterBySubmission = new Map<string, { id: string; name: string; sizeBytes: number; uploadedAt: string }>();
  for (const l of (letters.data ?? []) as { id: string; bank_submission_id: string; original_name: string; size_bytes: number; uploaded_at: string }[]) {
    if (!ids.has(l.bank_submission_id)) continue;
    const seen = letterBySubmission.get(l.bank_submission_id);
    if (!seen || seen.uploadedAt < l.uploaded_at) {
      letterBySubmission.set(l.bank_submission_id, { id: l.id, name: l.original_name, sizeBytes: Number(l.size_bytes), uploadedAt: l.uploaded_at });
    }
  }

  const today = dubaiToday(ctx.now);
  const submissions: SubmissionView[] = subRows.map((s) => {
    const bank = bankById.get(s.bank_id);
    const offer =
      s.status === "pre_approved" && s.max_amount_aed !== null && s.rate_pct !== null && s.rate_type && s.valid_until
        ? {
            amountAed: Number(s.max_amount_aed),
            ratePct: Number(s.rate_pct),
            rateType: s.rate_type,
            fixedYears: s.fixed_years,
            validUntil: s.valid_until,
            monthlyAed: offerMonthlyPayment(Number(s.max_amount_aed), Number(s.rate_pct)),
            expired: s.valid_until < today,
          }
        : null;
    const letter = letterBySubmission.get(s.id);
    return {
      id: s.id,
      bank: {
        id: s.bank_id,
        code: bank?.code ?? "",
        name: bank?.name ?? "",
        label: bank ? bankLabel(bank) : "",
        color: bank?.brand_color ?? null,
      },
      status: s.status,
      sentAt: s.sent_at,
      respondedAt: s.responded_at,
      reminderSentAt: s.reminder_sent_at,
      offer,
      letter: letter ? { id: letter.id, name: letter.name, sizeBytes: letter.sizeBytes } : null,
      notes: s.notes,
    };
  });

  const last = ((accepted.data ?? []) as { accepted_by: string | null; accepted_at: string | null }[])[0];
  const lastName = last?.accepted_by ? file.team.find((m) => m.id === last.accepted_by)?.name ?? null : null;
  const salary = file.documents.length ? await salaryOf(db, file.id) : null;

  return {
    file,
    submissions,
    tiles: {
      accepted: file.documents.filter((d) => d.state === "accepted").length,
      total: file.documents.length,
      lastAccepted: last?.accepted_at && lastName ? { name: lastName, at: last.accepted_at } : null,
      consentGivenAt: (consent.data as { given_at: string } | null)?.given_at ?? null,
      sentCount: submissions.length,
      sentAt: submissions.length ? submissions.reduce((min, s) => (s.sentAt < min ? s.sentAt : min), submissions[0]!.sentAt) : null,
    },
    basis:
      file.employment === "business_owner" ? { kind: "business" } : salary !== null ? { kind: "salary", salaryAed: salary } : { kind: "none" },
    ltvPct: file.residency === "uae_national" ? ctx.settings.ltv_national_pct : ctx.settings.ltv_expat_pct,
    leadSubmissionId: (request.data as { lead_bank_submission_id: string | null } | null)?.lead_bank_submission_id ?? null,
  };
}

/** The monthly gross salary the reviewer recorded on the salary certificate (C3). */
async function salaryOf(db: SupabaseClient, requestId: string): Promise<number | null> {
  const { data } = await db
    .from("mortgage_documents")
    .select("recorded")
    .eq("request_id", requestId)
    .eq("kind", "salary_certificate")
    .maybeSingle();
  const value = (data as { recorded: Record<string, unknown> | null } | null)?.recorded?.monthly_gross_aed;
  return typeof value === "number" ? value : null;
}
