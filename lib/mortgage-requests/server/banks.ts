import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailSiteUrl } from "@/lib/email-templates";
import { DOCUMENT_SETS, type DocKind, type EmploymentType } from "../documents";
import { MortgageApiError, notFound } from "./errors";
import type { OpenedFile } from "./files";
import type { MortgageStorage } from "./storage";
import { hashToken, newToken } from "./tokens";

/**
 * Partner banks (Phase 6; SPEC §2.4, §8): what a bank is sent, and what it
 * sees when it opens it.
 *
 * A package is a secure page, not attachments: one link per bank and file,
 * only its hash stored, expiring after `mortgage_settings.link_expiry_days`
 * (the applicant links' lifetime; a reminder issues a fresh one). Behind it
 * are a structured summary and the accepted documents. Every open and every
 * download is written to the activity log, as the bank, before anything is
 * shown — and a withdrawn or expired link shows nothing at all.
 */

export type BankRow = {
  id: string;
  code: string;
  name: string;
  brand_color: string | null;
  active: boolean;
  package_emails: string[];
  sort_order: number;
};

export const BANK_COLUMNS = "id, code, name, brand_color, active, package_emails, sort_order";

/** How a bank is named in the activity log, as the designs do: "Mashreq", but "FAB". Mirrors `mortgage_bank_label()` (0149). */
export function bankLabel(bank: { code: string; name: string }): string {
  const name = bank.name.trim();
  return name.includes(" ") ? bank.code : name;
}

/** The banks, in the team's order. */
export async function loadBanks(db: SupabaseClient): Promise<BankRow[]> {
  const { data, error } = await db.from("mortgage_partner_banks").select(BANK_COLUMNS).order("sort_order").order("name");
  if (error) throw new Error(`banks read failed: ${error.message}`);
  return ((data ?? []) as BankRow[]).map((b) => ({ ...b, package_emails: b.package_emails ?? [] }));
}

/** A bank can be sent a file when it's switched on and has somewhere to receive it. */
export function sendable(bank: Pick<BankRow, "active" | "package_emails">): boolean {
  return bank.active && bank.package_emails.length > 0;
}

// ── Sending ─────────────────────────────────────────────────────

export type PackageLink = { bankId: string; token: string; expiresAt: string };

/** A fresh link per bank: the token for the email, its hash for the database. */
export function packageLinks(
  bankIds: readonly string[],
  now: Date,
  days: number,
): { links: PackageLink[]; packages: { bank_id: string; token_hash: string; expires_at: string }[] } {
  const expiresAt = new Date(now.getTime() + days * 86_400_000).toISOString();
  const links = bankIds.map((bankId) => ({ bankId, token: newToken(), expiresAt }));
  return { links, packages: links.map((l) => ({ bank_id: l.bankId, token_hash: hashToken(l.token), expires_at: l.expiresAt })) };
}

export function packageUrl(token: string): string {
  return `${emailSiteUrl()}/mortgages/p/${token}`;
}

// ── The package page (service role) ─────────────────────────────

export const PACKAGE_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

type SubmissionRow = {
  id: string;
  request_id: string;
  bank_id: string;
  status: "sent" | "pre_approved" | "declined" | "withdrawn";
  sent_at: string;
  sent_by: string | null;
  package_expires_at: string | null;
};

export type FoundPackage = { submission: SubmissionRow; bank: BankRow };

/** The submission a package token opens, or null. A malformed token is looked up as nothing. */
export async function findPackage(db: SupabaseClient, token: string): Promise<FoundPackage | null> {
  if (!PACKAGE_TOKEN.test(token)) return null;
  const { data, error } = await db
    .from("mortgage_bank_submissions")
    .select("id, request_id, bank_id, status, sent_at, sent_by, package_expires_at")
    .eq("package_token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw new Error(`package read failed: ${error.code}`);
  const submission = data as SubmissionRow | null;
  if (!submission) return null;
  const { data: bank } = await db.from("mortgage_partner_banks").select(BANK_COLUMNS).eq("id", submission.bank_id).single();
  return { submission, bank: bank as BankRow };
}

/** Whether a package can be opened. Withdrawn and unknown read the same: the page never says which. */
export function packageState(found: FoundPackage | null, now: Date): "open" | "expired" | "unavailable" {
  if (!found || found.submission.status === "withdrawn") return "unavailable";
  const expires = found.submission.package_expires_at;
  if (!expires || new Date(expires).getTime() <= now.getTime()) return "expired";
  return "open";
}

/** An open or a download, written as the bank, before anything is shown (SPEC §8). */
export async function logBankAccess(
  db: SupabaseClient,
  event: { requestId: string; type: "bank.package_opened" | "document.downloaded"; data: Record<string, unknown> },
): Promise<void> {
  const { error } = await db.from("mortgage_events").insert({
    request_id: event.requestId,
    actor_kind: "bank",
    type: event.type,
    data: event.data,
  });
  if (error) throw new Error(`access log failed: ${error.code}`);
}

export type PackageFile = {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  pageCount: number | null;
  periodFrom: string | null;
  periodTo: string | null;
};

export type PackageView = {
  reference: string;
  bank: { name: string; label: string };
  adviser: string | null;
  sentAt: string;
  expiresAt: string;
  applicant: {
    fullName: string;
    dateOfBirth: string;
    residency: "uae_national" | "uae_resident_expat";
    employment: EmploymentType;
  };
  /** What the reviewer recorded for pricing (the salary certificate), when they did. */
  recorded: { monthlyGrossAed: number | null; employer: string | null; employedSince: string | null };
  ltvPct: number;
  documents: { kind: DocKind; files: PackageFile[] }[];
};

/** Everything the package page shows. The request's accepted documents only, in the set's order. */
export async function packageView(db: SupabaseClient, found: FoundPackage): Promise<PackageView> {
  const { submission, bank } = found;
  const [{ data: request, error }, { data: docs }, { data: settings }, adviser] = await Promise.all([
    db
      .from("mortgage_requests")
      .select("reference, full_name, date_of_birth, residency, employment_type")
      .eq("id", submission.request_id)
      .single(),
    db
      .from("mortgage_documents")
      .select(
        "id, kind, state, recorded, files:mortgage_files(id, original_name, mime, size_bytes, page_count, period_from, period_to, state, scan_status, uploaded_at)",
      )
      .eq("request_id", submission.request_id),
    db.from("mortgage_settings").select("ltv_national_pct, ltv_expat_pct").eq("id", 1).single(),
    submission.sent_by
      ? db.from("staff").select("display_name").eq("user_id", submission.sent_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (error) throw new Error(`request read failed: ${error.code}`);
  const r = request as {
    reference: string;
    full_name: string;
    date_of_birth: string;
    residency: "uae_national" | "uae_resident_expat";
    employment_type: EmploymentType;
  };
  type FileDb = {
    id: string;
    original_name: string;
    mime: string;
    size_bytes: number;
    page_count: number | null;
    period_from: string | null;
    period_to: string | null;
    state: string;
    scan_status: string;
    uploaded_at: string;
  };
  const rows = (docs ?? []) as { kind: DocKind; state: string; recorded: Record<string, unknown> | null; files: FileDb[] }[];
  const order = DOCUMENT_SETS[r.employment_type];
  const documents = rows
    .filter((d) => d.state === "accepted")
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((d) => ({
      kind: d.kind,
      files: d.files
        .filter((f) => f.state === "active" && f.scan_status === "clean")
        .sort((a, b) => (a.period_from ?? a.uploaded_at).localeCompare(b.period_from ?? b.uploaded_at))
        .map((f) => ({
          id: f.id,
          name: f.original_name,
          mime: f.mime,
          sizeBytes: Number(f.size_bytes),
          pageCount: f.page_count,
          periodFrom: f.period_from,
          periodTo: f.period_to,
        })),
    }));
  const certificate = rows.find((d) => d.kind === "salary_certificate")?.recorded ?? {};
  const s = settings as { ltv_national_pct: number; ltv_expat_pct: number } | null;
  return {
    reference: r.reference,
    bank: { name: bank.name, label: bankLabel(bank) },
    adviser: (adviser.data as { display_name: string } | null)?.display_name ?? null,
    sentAt: submission.sent_at,
    expiresAt: submission.package_expires_at!,
    applicant: {
      fullName: r.full_name,
      dateOfBirth: r.date_of_birth,
      residency: r.residency,
      employment: r.employment_type,
    },
    recorded: {
      monthlyGrossAed: typeof certificate.monthly_gross_aed === "number" ? certificate.monthly_gross_aed : null,
      employer: typeof certificate.employer === "string" ? certificate.employer : null,
      employedSince: typeof certificate.employed_since === "string" ? certificate.employed_since : null,
    },
    ltvPct: r.residency === "uae_national" ? Number(s?.ltv_national_pct ?? 85) : Number(s?.ltv_expat_pct ?? 80),
    documents,
  };
}

/**
 * One of the package's files, for the bank: only an accepted document's
 * active, clean file on this request, and the download logged first.
 */
export async function openPackageFile(
  deps: { db: SupabaseClient; storage: MortgageStorage; now?: () => Date },
  token: string,
  fileId: string,
): Promise<OpenedFile> {
  const found = await findPackage(deps.db, token);
  const state = packageState(found, deps.now?.() ?? new Date());
  if (state === "expired") throw new MortgageApiError(410, "link_unavailable");
  if (state !== "open") throw notFound();
  const { submission, bank } = found!;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw notFound();

  const { data: file } = await deps.db
    .from("mortgage_files")
    .select("id, storage_key, original_name, mime, state, scan_status, kind, document:mortgage_documents(request_id, state)")
    .eq("id", fileId)
    .maybeSingle();
  const row = file as {
    id: string;
    storage_key: string;
    original_name: string;
    mime: string;
    state: string;
    scan_status: string;
    kind: DocKind | null;
    document: { request_id: string; state: string } | null;
  } | null;
  if (
    !row ||
    !row.document ||
    row.document.request_id !== submission.request_id ||
    row.document.state !== "accepted" ||
    row.state !== "active" ||
    row.scan_status !== "clean"
  ) {
    throw notFound();
  }

  await logBankAccess(deps.db, {
    requestId: submission.request_id,
    type: "document.downloaded",
    data: { file_id: row.id, kind: row.kind, bank: bank.code, label: bankLabel(bank) },
  });
  const bytes = await deps.storage.read(row.storage_key);
  if (!bytes) throw notFound();
  return { bytes, mime: row.mime, name: row.original_name, sizeBytes: bytes.length };
}
