/**
 * Secure links (docs/mortgage/SPEC.md §8, PLAN Phase 5): the re-upload link a
 * reviewer sends from C4, and the pre-approval invite sent from C6. Both open
 * `/mortgages/r/[token]` (W8).
 *
 *   · The token is the URL. Only its SHA-256 is stored; it is never logged.
 *   · A code first: 6 digits, 10 minutes, a new one at most every minute, five
 *     wrong tries per link and the link is locked for good. D5: the code goes
 *     by WhatsApp once the Business API is connected (D1); until then, email.
 *   · A right code starts a session: a random cookie whose hash is stored on
 *     the link, for two hours. Everything after the code asks for it.
 *   · Uploads go to a draft of the link's own, through the same pipeline as
 *     W5/W6 (drafts.ts), scoped to the link's documents; nothing reaches the
 *     request until the applicant sends it.
 *
 * Nothing here knows about HTTP: the route handlers and the page wrap it, and
 * the database tests drive it against the local stack.
 */

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mortgageCodeEmail } from "@/lib/content-assets/system-emails";
import { sendEmail, type SendEmailInput, type SendEmailResult } from "@/lib/email";
import { CONSENT_WORDINGS, isConsentVersion } from "../consent";
import { coverage, monthOf, type Coverage } from "../coverage";
import { DOCUMENT_RULES, DOCUMENT_SETS, requiredStatementMonths, type DocKind, type EmploymentType } from "../documents";
import { maskMobile } from "../format";
import { clockDueFrom, clockResume } from "../sla";
import {
  completeInDraft,
  createDraft,
  deleteInDraft,
  presignIntoDraft,
  statusInDraft,
  type DraftDeps,
  type DraftScope,
  type FileStatus,
} from "./drafts";
import { MortgageApiError } from "./errors";
import { MAX_ATTEMPTS as MAX_SEND_ATTEMPTS, scrubReason } from "./notify";
import { loadMortgageSettings } from "./settings";
import { fromDatabase, removeOrphans, retireUnlisted } from "./submit";
import { hashToken, newToken } from "./tokens";

export const LINK_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
export const CODE_TTL_MS = 10 * 60_000;
export const CODE_COOLDOWN_SECONDS = 60;
export const SESSION_TTL_MS = 2 * 60 * 60_000;
export const MAX_CODE_ATTEMPTS = 5;

export type LinkPurpose = "reupload" | "preapproval_invite";

export type LinkRow = {
  id: string;
  request_id: string;
  purpose: LinkPurpose;
  document_id: string | null;
  expires_at: string;
  otp_attempts: number;
  otp_sent_at: string | null;
  otp_channel: "email" | "whatsapp" | null;
  verified_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
  draft_id: string | null;
  session_hash: string | null;
  session_expires_at: string | null;
};

const LINK_COLUMNS =
  "id, request_id, purpose, document_id, expires_at, otp_attempts, otp_sent_at, otp_channel, verified_at, used_at, revoked_at, created_by, created_at, draft_id, session_hash, session_expires_at";

export type LinkDeps = DraftDeps & {
  /** Defaults to lib/email's `sendEmail`; tests pass their own. */
  send?: (input: SendEmailInput) => Promise<SendEmailResult>;
};

const nowOf = (deps: { now?: () => Date }) => deps.now?.() ?? new Date();

/** The link a token opens, or null. A malformed token is looked up as nothing, never an error. */
export async function findLink(db: SupabaseClient, token: string): Promise<LinkRow | null> {
  if (!LINK_TOKEN.test(token)) return null;
  const { data, error } = await db
    .from("mortgage_access_links")
    .select(LINK_COLUMNS)
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw new Error(`link read failed: ${error.code}`);
  return (data as LinkRow | null) ?? null;
}

export type LinkState = "unavailable" | "expired" | "used" | "locked" | "code" | "verified";

/**
 * Where a link stands for this browser. Revoked and unknown read the same
 * ("unavailable"): the page never says which.
 */
export function linkState(link: LinkRow | null, now: Date, session: string | null): LinkState {
  if (!link || link.revoked_at) return "unavailable";
  if (link.used_at) return "used";
  if (link.otp_attempts >= MAX_CODE_ATTEMPTS) return "locked";
  if (new Date(link.expires_at).getTime() <= now.getTime()) return "expired";
  return sessionValid(link, now, session) ? "verified" : "code";
}

function sessionValid(link: LinkRow, now: Date, session: string | null): boolean {
  if (!session || !link.session_hash || !link.session_expires_at) return false;
  if (new Date(link.session_expires_at).getTime() <= now.getTime()) return false;
  const a = Buffer.from(hashToken(session), "hex");
  const b = Buffer.from(link.session_hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The session cookie's name: one per link, so two links in one browser don't collide. */
export function sessionCookieName(linkId: string): string {
  return `bz_mlink_${linkId.replace(/-/g, "").slice(0, 12)}`;
}

/** The verified link a request carries, or the reason it can't be used. */
export async function requireSession(
  deps: Pick<DraftDeps, "db" | "now">,
  token: string,
  readCookie: (name: string) => string | undefined,
): Promise<LinkRow> {
  const link = await findLink(deps.db, token);
  const state = linkState(link, nowOf(deps), link ? (readCookie(sessionCookieName(link.id)) ?? null) : null);
  if (state === "verified") return link!;
  if (state === "code") throw new MortgageApiError(401, "unauthorised");
  if (state === "locked") throw new MortgageApiError(423, "link_locked");
  throw new MortgageApiError(410, "link_unavailable");
}

// ── Codes ────────────────────────────────────────────────────────

/** A code's hash, salted with its link, so one leaked hash opens nothing else. */
export function codeHash(linkId: string, code: string): string {
  return createHash("sha256").update(`${linkId}:${code}`).digest("hex");
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** "k•••@example.com" — enough for the applicant to know which inbox. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  return `${local[0]}•••@${domain}`;
}

type Applicant = {
  id: string;
  reference: string;
  service: "pre_approval" | "consultancy";
  status: string;
  full_name: string;
  mobile_e164: string;
  email: string;
  locale: string;
  employment_type: EmploymentType;
  residency: "uae_national" | "uae_resident_expat";
  submitted_at: string;
  owner_staff_id: string | null;
  sla_remaining_seconds: number | null;
};

async function applicantOf(db: SupabaseClient, requestId: string): Promise<Applicant> {
  const { data, error } = await db
    .from("mortgage_requests")
    .select(
      "id, reference, service, status, full_name, mobile_e164, email, locale, employment_type, residency, submitted_at, owner_staff_id, sla_remaining_seconds",
    )
    .eq("id", requestId)
    .single();
  if (error) throw new Error(`request read failed: ${error.code}`);
  return data as Applicant;
}

/**
 * Send a new code for a link (`POST /api/mortgage/links/:token/otp`). Where it
 * went comes back masked, for the page.
 */
export async function sendLinkCode(
  deps: LinkDeps,
  token: string,
): Promise<{ channel: "email" | "whatsapp"; destination: string }> {
  const now = nowOf(deps);
  const link = await findLink(deps.db, token);
  const state = linkState(link, now, null);
  if (state === "locked") throw new MortgageApiError(423, "link_locked");
  if (state !== "code") throw new MortgageApiError(410, "link_unavailable");

  // D5 is WhatsApp; the Business API (D1) isn't connected, so email for now.
  const channel = "email" as const;
  const code = newCode();
  const { data, error } = await deps.db.rpc("mortgage_link_issue_code", {
    p_link_id: link!.id,
    p_code_hash: codeHash(link!.id, code),
    p_code_expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    p_channel: channel,
    p_cooldown_seconds: CODE_COOLDOWN_SECONDS,
    p_at: now.toISOString(),
  });
  if (error) throw new Error(`code issue failed: ${error.code}`);
  if (data === "cooldown") {
    throw new MortgageApiError(429, "code_cooldown", undefined, { retryAfterSeconds: CODE_COOLDOWN_SECONDS });
  }
  if (data === "locked") throw new MortgageApiError(423, "link_locked");
  if (data !== "sent") throw new MortgageApiError(410, "link_unavailable");

  const applicant = await applicantOf(deps.db, link!.request_id);
  const email = await mortgageCodeEmail(
    { name: applicant.full_name, code, minutes: CODE_TTL_MS / 60_000 },
    applicant.locale === "ar" ? "ar" : "en",
  );
  let result: SendEmailResult;
  try {
    result = await (deps.send ?? sendEmail)({ to: applicant.email, subject: email.subject, text: email.text, html: email.html });
  } catch (e) {
    result = { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
  // The outbox keeps the record, never the code.
  await deps.db.from("mortgage_notifications").insert({
    request_id: link!.request_id,
    kind: "otp_code",
    channel,
    status: result.status === "ok" ? "sent" : result.status === "skipped" ? "skipped" : "failed",
    attempts: MAX_SEND_ATTEMPTS,
    dedupe: `${link!.id}:${now.toISOString()}`,
    sent_at: result.status === "ok" ? now.toISOString() : null,
    provider_id: result.status === "ok" ? result.id : null,
    last_error: result.status === "error" ? scrubReason(result.message) : result.status === "skipped" ? scrubReason(result.reason) : null,
  });
  if (result.status === "error") throw new MortgageApiError(502, "code_failed");
  return { channel, destination: maskEmail(applicant.email) };
}

/**
 * Check a code (`POST …/verify`). A right one returns the session token for
 * the cookie; a wrong one says how many tries are left.
 */
export async function verifyLinkCode(
  deps: Pick<DraftDeps, "db" | "now">,
  token: string,
  code: string,
): Promise<{ linkId: string; session: string; expiresAt: string }> {
  const now = nowOf(deps);
  const link = await findLink(deps.db, token);
  const state = linkState(link, now, null);
  if (state === "locked") throw new MortgageApiError(423, "link_locked");
  if (state !== "code" && state !== "verified") throw new MortgageApiError(410, "link_unavailable");
  if (!/^\d{6}$/.test(code)) throw new MortgageApiError(422, "invalid", "the code is six digits", {}, "code");

  const session = newToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const { data, error } = await deps.db.rpc("mortgage_link_verify", {
    p_link_id: link!.id,
    p_code_hash: codeHash(link!.id, code),
    p_session_hash: hashToken(session),
    p_session_expires_at: expiresAt,
    p_at: now.toISOString(),
  });
  if (error) throw new Error(`code check failed: ${error.code}`);
  const outcome = data as { result: string; attempts_left?: number };
  switch (outcome.result) {
    case "ok":
      return { linkId: link!.id, session, expiresAt };
    case "wrong":
      throw new MortgageApiError(422, "code_wrong", undefined, { attemptsLeft: outcome.attempts_left ?? 0 }, "code");
    case "expired":
      throw new MortgageApiError(422, "code_expired", undefined, {}, "code");
    case "locked":
      throw new MortgageApiError(423, "link_locked");
    default:
      throw new MortgageApiError(410, "link_unavailable");
  }
}

// ── What the verified page shows ────────────────────────────────

/**
 * The adviser who sent the link, as W8 shows them. The label under the name is
 * their job title from the staff record (D16/FE-7), the one /agents shows; a
 * record without one shows only the time.
 */
export type StaffCard = { name: string; firstName: string; initials: string; title: string | null };

async function adviserOf(db: SupabaseClient, staffId: string | null): Promise<StaffCard | null> {
  if (!staffId) return null;
  const { data } = await db.from("staff").select("display_name, title").eq("user_id", staffId).maybeSingle();
  const row = data as { display_name: string; title: string | null } | null;
  if (!row) return null;
  const parts = row.display_name.trim().split(/\s+/);
  const initials = (parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : row.display_name.slice(0, 2)).toUpperCase();
  return { name: row.display_name, firstName: parts[0] ?? row.display_name, initials, title: row.title?.trim() || null };
}

export type ReuploadReason = "unreadable" | "wrong_document" | "expired" | "period_incomplete" | "pages_missing" | "other";

/**
 * Whether the files sent replace the document's (a single-file kind, or a
 * document that was unreadable, wrong or expired) or join them (statements
 * short of months, missing pages).
 */
export function replacesFiles(kind: DocKind, reason: ReuploadReason): boolean {
  return DOCUMENT_RULES[kind].maxFiles === 1 || reason === "unreadable" || reason === "wrong_document" || reason === "expired";
}

export type ReuploadContext = {
  reference: string;
  applicant: { fullName: string; firstName: string; maskedMobile: string; codeSentTo: string };
  adviser: StaffCard | null;
  request: { reason: ReuploadReason; message: string; sentAt: string };
  document: {
    kind: DocKind;
    replace: boolean;
    existingFiles: { name: string; sizeBytes: number }[];
    usedBytes: number;
    limitBytes: number;
    coverage: Coverage | null;
  };
  otherDocuments: { kind: DocKind; state: "to_review" | "accepted" | "reupload_requested" }[];
};

function codeSentTo(link: LinkRow, applicant: Applicant): string {
  return link.otp_channel === "email" ? maskEmail(applicant.email) : maskMobile(applicant.mobile_e164);
}

export async function reuploadContext(db: SupabaseClient, link: LinkRow): Promise<ReuploadContext> {
  const applicant = await applicantOf(db, link.request_id);
  const [reupload, documents, files, adviser] = await Promise.all([
    db
      .from("mortgage_reupload_requests")
      .select("reason, message, requested_at, requested_by")
      .eq("access_link_id", link.id)
      .single(),
    db.from("mortgage_documents").select("id, kind, state").eq("request_id", link.request_id),
    db
      .from("mortgage_files")
      .select("original_name, size_bytes, period_from, period_to, uploaded_at")
      .eq("document_id", link.document_id!)
      .eq("state", "active")
      .order("uploaded_at"),
    adviserOf(db, link.created_by),
  ]);
  if (reupload.error) throw new Error(`re-upload read failed: ${reupload.error.code}`);
  if (documents.error) throw new Error(`documents read failed: ${documents.error.code}`);
  if (files.error) throw new Error(`files read failed: ${files.error.code}`);

  const r = reupload.data as { reason: ReuploadReason; message: string; requested_at: string };
  const docs = documents.data as { id: string; kind: DocKind; state: ReuploadContext["otherDocuments"][number]["state"] }[];
  const doc = docs.find((d) => d.id === link.document_id)!;
  const fileRows = files.data as { original_name: string; size_bytes: number; period_from: string | null; period_to: string | null }[];
  const rule = DOCUMENT_RULES[doc.kind];
  const replace = replacesFiles(doc.kind, r.reason);
  const required = requiredStatementMonths(doc.kind, applicant.submitted_at);
  const order = DOCUMENT_SETS[applicant.employment_type];

  return {
    reference: applicant.reference,
    applicant: {
      fullName: applicant.full_name,
      firstName: applicant.full_name.trim().split(/\s+/)[0] ?? applicant.full_name,
      maskedMobile: maskMobile(applicant.mobile_e164),
      codeSentTo: codeSentTo(link, applicant),
    },
    adviser,
    request: { reason: r.reason, message: r.message, sentAt: r.requested_at },
    document: {
      kind: doc.kind,
      replace,
      existingFiles: fileRows.map((f) => ({ name: f.original_name, sizeBytes: Number(f.size_bytes) })),
      usedBytes: replace ? 0 : fileRows.reduce((sum, f) => sum + Number(f.size_bytes), 0),
      limitBytes: rule.maxTotalBytes ?? rule.maxFileBytes * rule.maxFiles,
      coverage: required.length
        ? coverage(
            required,
            fileRows.map((f) => ({ from: f.period_from ? monthOf(f.period_from) : null, to: f.period_to ? monthOf(f.period_to) : null })),
          )
        : null,
    },
    otherDocuments: docs
      .filter((d) => d.id !== link.document_id)
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
      .map((d) => ({ kind: d.kind, state: d.state })),
  };
}

export type InviteContext = {
  /** The consultancy request the invite was sent from. */
  reference: string;
  applicant: { fullName: string; firstName: string; maskedMobile: string; codeSentTo: string };
  adviser: StaffCard | null;
  employment: EmploymentType;
  residency: "uae_national" | "uae_resident_expat";
  kinds: readonly DocKind[];
};

export async function inviteContext(db: SupabaseClient, link: LinkRow): Promise<InviteContext> {
  const applicant = await applicantOf(db, link.request_id);
  return {
    reference: applicant.reference,
    applicant: {
      fullName: applicant.full_name,
      firstName: applicant.full_name.trim().split(/\s+/)[0] ?? applicant.full_name,
      maskedMobile: maskMobile(applicant.mobile_e164),
      codeSentTo: codeSentTo(link, applicant),
    },
    adviser: await adviserOf(db, link.created_by),
    employment: applicant.employment_type,
    residency: applicant.residency,
    kinds: DOCUMENT_SETS[applicant.employment_type],
  };
}

// ── Uploads through a link ──────────────────────────────────────

/** The link's own draft, made at its first upload and living as long as the link. */
async function draftOf(deps: DraftDeps, link: LinkRow): Promise<string> {
  if (link.draft_id) return link.draft_id;
  const made = await createDraft(deps, { ip: null, expiresAt: link.expires_at });
  const { data, error } = await deps.db
    .from("mortgage_access_links")
    .update({ draft_id: made.draftId })
    .eq("id", link.id)
    .is("draft_id", null)
    .select("draft_id")
    .maybeSingle();
  if (error) throw new Error(`link update failed: ${error.code}`);
  if (data) return made.draftId;
  // Another upload made one first: use it, and drop ours.
  await deps.db.from("mortgage_upload_drafts").delete().eq("id", made.draftId);
  const again = await deps.db.from("mortgage_access_links").select("draft_id").eq("id", link.id).single();
  return (again.data as { draft_id: string }).draft_id;
}

/** What a link's uploads may be, and what they count against. */
async function scopeOf(deps: DraftDeps, link: LinkRow): Promise<{ scope: DraftScope; kind?: DocKind }> {
  if (link.purpose === "preapproval_invite") {
    const applicant = await applicantOf(deps.db, link.request_id);
    return { scope: { kinds: DOCUMENT_SETS[applicant.employment_type] } };
  }
  const [{ data: doc }, { data: reupload }] = await Promise.all([
    deps.db.from("mortgage_documents").select("kind").eq("id", link.document_id!).single(),
    deps.db.from("mortgage_reupload_requests").select("reason").eq("access_link_id", link.id).single(),
  ]);
  const kind = (doc as { kind: DocKind }).kind;
  const reason = (reupload as { reason: ReuploadReason }).reason;
  if (replacesFiles(kind, reason)) return { scope: { kinds: [kind] }, kind };
  const { data: files } = await deps.db
    .from("mortgage_files")
    .select("size_bytes")
    .eq("document_id", link.document_id!)
    .eq("state", "active");
  return {
    scope: { kinds: [kind], existing: ((files ?? []) as { size_bytes: number }[]).map((f) => ({ sizeBytes: Number(f.size_bytes) })) },
    kind,
  };
}

export async function presignLinkFile(
  deps: DraftDeps,
  link: LinkRow,
  input: { kind?: string; name: string; size: number; mime: string; replaces?: string[] },
) {
  const { scope, kind } = await scopeOf(deps, link);
  const draftId = await draftOf(deps, link);
  return presignIntoDraft(deps, draftId, { ...input, kind: kind ?? input.kind ?? "" }, scope);
}

export async function completeLinkFile(deps: DraftDeps, link: LinkRow, fileId: string): Promise<FileStatus> {
  if (!link.draft_id) throw new MortgageApiError(404, "not_found");
  const { scope } = await scopeOf(deps, link);
  return completeInDraft(deps, link.draft_id, fileId, scope);
}

export async function linkFileStatus(deps: DraftDeps, link: LinkRow, fileId: string): Promise<FileStatus> {
  if (!link.draft_id) throw new MortgageApiError(404, "not_found");
  return statusInDraft(deps, link.draft_id, fileId);
}

export async function deleteLinkFile(deps: DraftDeps, link: LinkRow, fileId: string): Promise<void> {
  if (!link.draft_id) throw new MortgageApiError(404, "not_found");
  await deleteInDraft(deps, link.draft_id, fileId);
}

// ── Sending ─────────────────────────────────────────────────────

/**
 * Send the re-upload (W8's "Send documents"). The request resumes its promise
 * from the working time left at the pause (sla.ts), so the time left after the
 * resume is the time left at the pause (PLAN Phase 5).
 */
export async function fulfilReupload(
  deps: DraftDeps,
  link: LinkRow,
  fileIds: readonly string[],
): Promise<{ requestId: string; status: string }> {
  if (link.purpose !== "reupload") throw new MortgageApiError(410, "link_unavailable");
  if (fileIds.length === 0 || !link.draft_id) throw new MortgageApiError(409, "files_not_ready");
  const now = nowOf(deps);
  const [applicant, { policy }, { data: reupload }, { data: doc }] = await Promise.all([
    applicantOf(deps.db, link.request_id),
    loadMortgageSettings(deps.db),
    deps.db.from("mortgage_reupload_requests").select("reason").eq("access_link_id", link.id).single(),
    deps.db.from("mortgage_documents").select("kind").eq("id", link.document_id!).single(),
  ]);
  const sla = applicant.sla_remaining_seconds !== null ? clockResume(applicant, now, policy) : {};
  const replace = replacesFiles((doc as { kind: DocKind }).kind, (reupload as { reason: ReuploadReason }).reason);

  const { data, error } = await deps.db.rpc("mortgage_fulfil_reupload", {
    p_link_id: link.id,
    p_file_ids: [...fileIds],
    p_replace: replace,
    p_sla: sla,
    p_at: now.toISOString(),
  });
  if (error) {
    if (error.code === "MR410") throw new MortgageApiError(410, "link_unavailable");
    if (error.code === "MR422" && error.message.includes("files_not_ready")) throw new MortgageApiError(409, "files_not_ready");
    throw new Error(`re-upload failed: ${error.code}`);
  }
  const result = data as { request_id: string; status: string; retired_keys: string[] };
  // The superseded and unsent files' objects. Best effort: the rows say removed.
  if (result.retired_keys.length > 0) {
    try {
      await deps.storage.remove(result.retired_keys);
    } catch {
      // Unreachable objects cost storage, not privacy.
    }
  }
  return { requestId: result.request_id, status: result.status };
}

/**
 * Apply through a pre-approval invite: the applicant's own Fast Pre-Approval,
 * with the consultancy's details (never the browser's), linked to it.
 */
export async function submitInvite(
  deps: DraftDeps,
  link: LinkRow,
  input: { fileIds: readonly string[]; consentVersion: string; submissionKey: string; ip: string | null; userAgent: string | null },
): Promise<{ requestId: string; reference: string; submittedAt: string; dueAt: string | null }> {
  if (link.purpose !== "preapproval_invite") throw new MortgageApiError(410, "link_unavailable");
  if (!link.draft_id) throw new MortgageApiError(409, "files_not_ready");
  if (!isConsentVersion(input.consentVersion)) {
    throw new MortgageApiError(422, "invalid", "unknown consent wording", {}, "consent");
  }
  const now = nowOf(deps);
  await retireUnlisted(deps, link.draft_id, input.fileIds);
  const dueAt = clockDueFrom(now, (await loadMortgageSettings(deps.db)).policy);

  const { data, error } = await deps.db.rpc("mortgage_submit_invite", {
    p_link_id: link.id,
    p_draft_id: link.draft_id,
    p_submission_key: input.submissionKey,
    p_consent_version: input.consentVersion,
    p_consent_text: CONSENT_WORDINGS[input.consentVersion],
    p_ip: input.ip && isIP(input.ip) ? input.ip : null,
    p_user_agent: input.userAgent ? input.userAgent.slice(0, 500) : null,
    p_sla_due_at: dueAt,
    p_at: now.toISOString(),
  });
  if (error) {
    if (error.code === "MR410") throw new MortgageApiError(410, "link_unavailable");
    const mapped = fromDatabase(error);
    if (mapped) throw mapped;
    throw new Error(`invite submit failed: ${error.code}`);
  }
  const row = data as { id: string; reference: string; submitted_at: string; sla_due_at: string | null };
  await removeOrphans(deps, link.draft_id);
  return { requestId: row.id, reference: row.reference, submittedAt: row.submitted_at, dueAt: row.sla_due_at };
}

/**
 * A retried invite submit whose first try went through (the answer was lost
 * on the way back): the link is used and its session gone, so the retry is
 * recognised by the Idempotency-Key the first try carried, which only that
 * browser holds, and gets the same application back rather than "this link
 * can't be used".
 */
export async function inviteReplay(
  db: SupabaseClient,
  token: string,
  submissionKey: string,
): Promise<{ requestId: string; reference: string; submittedAt: string; dueAt: string | null } | null> {
  const link = await findLink(db, token);
  if (!link || link.purpose !== "preapproval_invite" || !link.used_at) return null;
  const { data } = await db
    .from("mortgage_requests")
    .select("id, reference, submitted_at, sla_due_at")
    .eq("submission_key", submissionKey)
    .eq("parent_request_id", link.request_id)
    .maybeSingle();
  const row = data as { id: string; reference: string; submitted_at: string; sla_due_at: string | null } | null;
  return row ? { requestId: row.id, reference: row.reference, submittedAt: row.submitted_at, dueAt: row.sla_due_at } : null;
}

/** The link's uploads that are ready and not yet sent: a reload brings them back. */
export async function draftReadyFiles(
  db: SupabaseClient,
  link: LinkRow,
): Promise<{ fileId: string; name: string; sizeBytes: number; mime: string; kind: DocKind }[]> {
  if (!link.draft_id) return [];
  const { data, error } = await db
    .from("mortgage_files")
    .select("id, original_name, size_bytes, mime, kind")
    .eq("draft_id", link.draft_id)
    .is("document_id", null)
    .eq("state", "active")
    .eq("scan_status", "clean")
    .order("uploaded_at");
  if (error) throw new Error(`draft files read failed: ${error.code}`);
  return ((data ?? []) as { id: string; original_name: string; size_bytes: number; mime: string; kind: DocKind }[]).map((f) => ({
    fileId: f.id,
    name: f.original_name,
    sizeBytes: Number(f.size_bytes),
    mime: f.mime,
    kind: f.kind,
  }));
}

/** For a used invite: the application it made (W8's "already applied"). */
export async function inviteOutcome(db: SupabaseClient, link: LinkRow): Promise<string | null> {
  const { data } = await db
    .from("mortgage_events")
    .select("data")
    .eq("request_id", link.request_id)
    .eq("type", "invite.used")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const reference = (data as { data: { reference?: unknown } } | null)?.data.reference;
  return typeof reference === "string" ? reference : null;
}
