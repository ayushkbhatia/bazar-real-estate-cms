/**
 * Upload drafts: where a Fast Pre-Approval applicant's files wait before they
 * submit (docs/mortgage/SPEC.md §4.2, PLAN Phase 2).
 *
 * The flow for one file, as W5/W6's upload engine drives it:
 *   presign  → the rules in documents.ts on the declared size and type,
 *              counting files still uploading → a signed PUT URL;
 *   PUT      → straight to storage, never through our functions;
 *   complete → the same rules again on the stored bytes' real size and type,
 *              then password-protected PDFs, page count, SHA-256, and a
 *              malware scan. A file that fails is deleted and marked removed.
 * Drafts expire after 24 hours; the mortgage-worker cron purges them.
 *
 * Nothing here knows about HTTP or Next.js: route handlers wrap it, and the
 * database tests drive it against the local Supabase stack.
 */

import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOC_KINDS,
  DOCUMENT_RULES,
  checkFile,
  mimeFromName,
  normaliseMime,
  type DocKind,
  type DocumentMime,
  type FileRuleError,
} from "../documents";
import { MortgageApiError, notFound } from "./errors";
import type { Scanner, ScanVerdict } from "./scan";
import { fileKey, type MortgageStorage } from "./storage";
import { hashToken, newToken, tokenMatches } from "./tokens";
import { inspectPdf, sha256Hex, sniffMime } from "./verify";

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
/** A signed upload URL lasts two hours; a file still pending after that won't arrive. */
export const PENDING_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_LIVE_FILES_PER_DRAFT = 30;

export type DraftDeps = {
  /** Service-role client. */
  db: SupabaseClient;
  storage: MortgageStorage;
  /** Null when no scanner is configured: files wait, unopenable, for one. */
  scanner: Scanner | null;
  now?: () => Date;
};

type DraftRow = { id: string; token_hash: string; expires_at: string; claimed_request_id: string | null };

export type FileRow = {
  id: string;
  draft_id: string | null;
  document_id: string | null;
  bank_submission_id: string | null;
  kind: DocKind | null;
  state: "pending" | "active" | "removed";
  storage_key: string;
  original_name: string;
  mime: string;
  size_bytes: number;
  page_count: number | null;
  sha256: string | null;
  scan_status: "pending" | "clean" | "infected" | "failed";
  uploaded_at: string;
  /** Files this one replaces, retired once it is clean (0141). */
  replaces: string[] | null;
};

export const FILE_COLUMNS =
  "id, draft_id, document_id, bank_submission_id, kind, state, storage_key, original_name, mime, size_bytes, page_count, sha256, scan_status, uploaded_at, replaces";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nowOf = (deps: DraftDeps) => deps.now?.() ?? new Date();

function ruleError(error: FileRuleError): MortgageApiError {
  switch (error.code) {
    case "bad_type":
      return new MortgageApiError(422, "bad_type");
    case "too_many_files":
      return new MortgageApiError(422, "too_many_files", undefined, { limit: error.limit });
    case "too_large":
      return new MortgageApiError(422, "too_large", undefined, {
        sizeBytes: error.sizeBytes,
        limitBytes: error.limitBytes,
      });
    case "total_exceeded":
      return new MortgageApiError(422, "total_exceeded", undefined, {
        totalBytes: error.totalBytes,
        limitBytes: error.limitBytes,
      });
  }
}

/** A file name safe to store and show: no path, no control characters, at most 200 characters. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
}

// ── Drafts ──────────────────────────────────────────────────────

export async function createDraft(
  deps: DraftDeps,
  input: { ip: string | null; /** A secure link's draft lives as long as the link (Phase 5). */ expiresAt?: string },
): Promise<{ draftId: string; draftToken: string; expiresAt: string }> {
  const now = nowOf(deps);
  const token = newToken();
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + DRAFT_TTL_MS).toISOString();
  const { data, error } = await deps.db
    .from("mortgage_upload_drafts")
    .insert({
      token_hash: hashToken(token),
      ip: input.ip && isIP(input.ip) ? input.ip : null,
      created_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(`draft insert failed: ${error.message}`);
  return { draftId: data.id as string, draftToken: token, expiresAt };
}

/** The draft, if the token is its own and it can still take files. */
export async function authoriseDraft(deps: DraftDeps, draftId: string, token: string | null): Promise<DraftRow> {
  if (!token || !UUID.test(draftId)) throw notFound();
  const { data, error } = await deps.db
    .from("mortgage_upload_drafts")
    .select("id, token_hash, expires_at, claimed_request_id")
    .eq("id", draftId)
    .maybeSingle();
  if (error) throw new Error(`draft read failed: ${error.message}`);
  // One answer for "no such draft" and "not your draft": no oracle.
  if (!data || !tokenMatches(token, data.token_hash)) throw notFound();
  if (data.claimed_request_id) throw new MortgageApiError(409, "draft_submitted");
  if (new Date(data.expires_at).getTime() <= nowOf(deps).getTime()) {
    throw new MortgageApiError(410, "draft_expired");
  }
  return data as DraftRow;
}

/** Files that count against a draft's limits: finished ones, and uploads still in time to arrive. */
export async function liveFiles(deps: DraftDeps, draftId: string): Promise<FileRow[]> {
  const { data, error } = await deps.db
    .from("mortgage_files")
    .select(FILE_COLUMNS)
    .eq("draft_id", draftId)
    .neq("state", "removed");
  if (error) throw new Error(`file read failed: ${error.message}`);
  const cutoff = nowOf(deps).getTime() - PENDING_UPLOAD_TTL_MS;
  return (data as FileRow[]).filter(
    (f) => f.state === "active" || new Date(f.uploaded_at).getTime() > cutoff,
  );
}

async function fileInDraft(deps: DraftDeps, draftId: string, fileId: string): Promise<FileRow> {
  if (!UUID.test(fileId)) throw notFound();
  const { data, error } = await deps.db
    .from("mortgage_files")
    .select(FILE_COLUMNS)
    .eq("id", fileId)
    .eq("draft_id", draftId)
    .maybeSingle();
  if (error) throw new Error(`file read failed: ${error.message}`);
  if (!data) throw notFound();
  return data as FileRow;
}

// ── One file ────────────────────────────────────────────────────

export type PresignInput = {
  draftId: string;
  token: string | null;
  kind: string;
  name: string;
  size: number;
  mime: string;
  /**
   * Ready files of the same kind this upload replaces (W5/W6 "Replace"). They
   * aren't counted against the kind's limits, and they're retired when this
   * file comes out of its scan clean — so a failed replace keeps the old file.
   */
  replaces?: readonly string[];
};

export async function presignFile(
  deps: DraftDeps,
  input: PresignInput,
): Promise<{ fileId: string; uploadUrl: string; headers: Record<string, string> }> {
  const draft = await authoriseDraft(deps, input.draftId, input.token);
  return presignIntoDraft(deps, draft.id, input);
}

/**
 * What a draft upload must also respect beyond its own files: a secure
 * link's (Phase 5) document kinds, and the files a document already holds —
 * a re-upload that adds to statements counts the ones received.
 */
export type DraftScope = {
  kinds?: readonly DocKind[];
  existing?: readonly { sizeBytes: number }[];
};

/** Presign into a draft the caller has already authorised (the draft's token, or a secure link's session). */
export async function presignIntoDraft(
  deps: DraftDeps,
  draftId: string,
  input: Pick<PresignInput, "kind" | "name" | "size" | "mime" | "replaces">,
  scope: DraftScope = {},
): Promise<{ fileId: string; uploadUrl: string; headers: Record<string, string> }> {
  const draft = { id: draftId };
  if (!(DOC_KINDS as readonly string[]).includes(input.kind) || (scope.kinds && !scope.kinds.includes(input.kind as DocKind))) {
    throw new MortgageApiError(422, "invalid", "unknown document kind", {}, "kind");
  }
  const kind = input.kind as DocKind;
  const name = safeFileName(input.name);
  if (!name) throw new MortgageApiError(422, "invalid", "file name required", {}, "name");
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    throw new MortgageApiError(422, "invalid", "size must be a positive whole number of bytes", {}, "size");
  }
  const declared = normaliseMime(input.mime) ?? mimeFromName(name);

  const live = await liveFiles(deps, draft.id);
  if (live.length >= MAX_LIVE_FILES_PER_DRAFT) {
    throw new MortgageApiError(422, "too_many_files", undefined, { limit: MAX_LIVE_FILES_PER_DRAFT });
  }
  const replaces = [...new Set(input.replaces ?? [])];
  for (const id of replaces) {
    const old = live.find((f) => f.id === id);
    if (!old || old.kind !== kind || old.state !== "active") {
      throw new MortgageApiError(422, "invalid", "replaces must name ready files of the same document", {}, "replaces");
    }
  }
  const sameKind = [
    ...live.filter((f) => f.kind === kind && !replaces.includes(f.id)).map((f) => ({ sizeBytes: Number(f.size_bytes) })),
    ...(scope.existing ?? []),
  ];
  const error = checkFile(kind, { sizeBytes: input.size, mime: declared ?? "" }, sameKind);
  if (error) throw ruleError(error);

  const id = randomUUID();
  const key = fileKey(id);
  const upload = await deps.storage.presignUpload(key, declared as DocumentMime);
  const { error: insertError } = await deps.db.from("mortgage_files").insert({
    id,
    draft_id: draft.id,
    kind,
    state: "pending",
    storage_key: key,
    original_name: name,
    mime: declared,
    size_bytes: input.size,
    scan_status: "pending",
    upload_round: 0,
    uploaded_at: nowOf(deps).toISOString(),
    replaces: replaces.length > 0 ? replaces : null,
  });
  if (insertError) throw new Error(`file insert failed: ${insertError.message}`);
  return { fileId: id, uploadUrl: upload.url, headers: upload.headers };
}

export type FileStatus =
  | { status: "uploading" }
  | { status: "scanning" }
  | { status: "ready"; sizeBytes: number; pageCount: number | null }
  | { status: "failed"; code: "infected" | "scan_failed" }
  | { status: "removed" };

export function statusOf(file: Pick<FileRow, "state" | "scan_status" | "size_bytes" | "page_count">): FileStatus {
  if (file.state === "pending") return { status: "uploading" };
  if (file.state === "active") {
    return file.scan_status === "clean"
      ? { status: "ready", sizeBytes: Number(file.size_bytes), pageCount: file.page_count }
      : { status: "scanning" };
  }
  if (file.scan_status === "infected") return { status: "failed", code: "infected" };
  if (file.scan_status === "failed") return { status: "failed", code: "scan_failed" };
  return { status: "removed" };
}

/**
 * A clean replacement retires the files it replaces (Replace on W5/W6). Only
 * draft files still active are touched: anything already attached to a
 * request is out of a draft's reach.
 */
async function retireReplaced(deps: DraftDeps, file: FileRow): Promise<void> {
  if (!file.draft_id || !file.replaces?.length) return;
  const { data, error } = await deps.db
    .from("mortgage_files")
    .select(FILE_COLUMNS)
    .in("id", file.replaces)
    .eq("draft_id", file.draft_id)
    .is("document_id", null)
    .eq("state", "active");
  if (error) throw new Error(`file read failed: ${error.message}`);
  await retireFiles(deps, data as FileRow[]);
}

/** Delete these files' objects and mark them removed. */
export async function retireFiles(deps: Pick<DraftDeps, "db" | "storage">, files: readonly FileRow[]): Promise<void> {
  for (const file of files) await discard(deps, file);
}

/** Delete a file's object and mark its row removed, keeping the row as the record. */
async function discard(
  deps: Pick<DraftDeps, "db" | "storage">,
  file: FileRow,
  scanStatus?: "infected" | "failed",
): Promise<void> {
  await deps.storage.remove([file.storage_key]);
  const { error } = await deps.db
    .from("mortgage_files")
    .update({ state: "removed", ...(scanStatus ? { scan_status: scanStatus } : {}) })
    .eq("id", file.id);
  if (error) throw new Error(`file update failed: ${error.message}`);
}

/**
 * The checks on a stored file's bytes, in the order that rejects cheapest
 * first: its real type, its real size against the kind's limits (with the
 * document's other files), then whether a PDF opens without a password.
 * Shared with the secure-link uploads of Phase 5.
 */
export async function checkStoredBytes(
  kind: DocKind,
  bytes: Uint8Array,
  otherFiles: readonly { sizeBytes: number }[],
): Promise<
  | { ok: true; mime: DocumentMime; sizeBytes: number; pageCount: number | null; sha256: string }
  | { ok: false; error: MortgageApiError }
> {
  const mime = sniffMime(bytes);
  if (!mime || !DOCUMENT_RULES[kind].mimes.includes(mime)) {
    return { ok: false, error: new MortgageApiError(422, "bad_type") };
  }
  const sizeError = checkFile(kind, { sizeBytes: bytes.length, mime }, otherFiles);
  if (sizeError) return { ok: false, error: ruleError(sizeError) };
  let pageCount: number | null = null;
  if (mime === "application/pdf") {
    const pdf = await inspectPdf(bytes);
    if (!pdf.ok) return { ok: false, error: new MortgageApiError(422, pdf.reason) };
    pageCount = pdf.pageCount;
  }
  return { ok: true, mime, sizeBytes: bytes.length, pageCount, sha256: sha256Hex(bytes) };
}

/**
 * Scan a checked file and record the verdict. Returns its status afterwards;
 * throws the upload error for infected or unscannable files, which are gone.
 */
async function scanAndRecord(deps: DraftDeps, file: FileRow, bytes: Uint8Array): Promise<FileStatus> {
  if (!deps.scanner) return { status: "scanning" };
  let verdict: ScanVerdict;
  try {
    verdict = await deps.scanner.scan(bytes);
  } catch {
    verdict = "unavailable";
  }
  if (verdict === "unavailable") return { status: "scanning" };
  if (verdict === "clean") {
    const { error } = await deps.db
      .from("mortgage_files")
      .update({ scan_status: "clean" })
      .eq("id", file.id)
      .eq("scan_status", "pending");
    if (error) throw new Error(`file update failed: ${error.message}`);
    await retireReplaced(deps, file);
    return { status: "ready", sizeBytes: Number(file.size_bytes), pageCount: file.page_count };
  }
  await discard(deps, file, verdict);
  throw new MortgageApiError(422, verdict === "infected" ? "infected" : "scan_failed");
}

export async function completeFile(
  deps: DraftDeps,
  input: { draftId: string; token: string | null; fileId: string },
): Promise<FileStatus> {
  const draft = await authoriseDraft(deps, input.draftId, input.token);
  return completeInDraft(deps, draft.id, input.fileId);
}

/** Complete an upload in a draft the caller has already authorised. */
export async function completeInDraft(
  deps: DraftDeps,
  draftId: string,
  fileId: string,
  scope: DraftScope = {},
): Promise<FileStatus> {
  const draft = { id: draftId };
  const input = { fileId };
  const file = await fileInDraft(deps, draft.id, input.fileId);
  // A repeated complete answers with where the file stands.
  if (file.state !== "pending") return statusOf(file);
  if (!file.kind) throw notFound();

  const bytes = await deps.storage.read(file.storage_key);
  if (!bytes) throw new MortgageApiError(409, "upload_missing");

  const others = [
    ...(await liveFiles(deps, draft.id))
      .filter((f) => f.kind === file.kind && f.id !== file.id && !(file.replaces ?? []).includes(f.id))
      .map((f) => ({ sizeBytes: Number(f.size_bytes) })),
    ...(scope.existing ?? []),
  ];
  const checked = await checkStoredBytes(file.kind, bytes, others);
  if (!checked.ok) {
    await discard(deps, file);
    throw checked.error;
  }

  const { data: updated, error } = await deps.db
    .from("mortgage_files")
    .update({
      state: "active",
      mime: checked.mime,
      size_bytes: checked.sizeBytes,
      page_count: checked.pageCount,
      sha256: checked.sha256,
    })
    .eq("id", file.id)
    .eq("state", "pending")
    .select(FILE_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`file update failed: ${error.message}`);
  // Someone else completed it first: answer with that.
  if (!updated) return statusOf(await fileInDraft(deps, draft.id, file.id));

  return scanAndRecord(deps, updated as FileRow, bytes);
}

export async function fileStatus(
  deps: DraftDeps,
  input: { draftId: string; token: string | null; fileId: string },
): Promise<FileStatus> {
  const draft = await authoriseDraft(deps, input.draftId, input.token);
  return statusInDraft(deps, draft.id, input.fileId);
}

export async function statusInDraft(deps: DraftDeps, draftId: string, fileId: string): Promise<FileStatus> {
  return statusOf(await fileInDraft(deps, draftId, fileId));
}

/** Cancel an upload or remove a file before submit. Idempotent. */
export async function deleteFile(
  deps: DraftDeps,
  input: { draftId: string; token: string | null; fileId: string },
): Promise<void> {
  const draft = await authoriseDraft(deps, input.draftId, input.token);
  await deleteInDraft(deps, draft.id, input.fileId);
}

export async function deleteInDraft(deps: DraftDeps, draftId: string, fileId: string): Promise<void> {
  const file = await fileInDraft(deps, draftId, fileId);
  if (file.state !== "removed") await discard(deps, file);
}

// ── The worker (cron) ───────────────────────────────────────────

/** Scan files still waiting for a verdict: the retry for scans that couldn't run inline. */
export async function scanPending(
  deps: DraftDeps,
  opts: { limit?: number } = {},
): Promise<{ clean: number; rejected: number; waiting: number }> {
  const result = { clean: 0, rejected: 0, waiting: 0 };
  const { data, error } = await deps.db
    .from("mortgage_files")
    .select(FILE_COLUMNS)
    .eq("state", "active")
    .eq("scan_status", "pending")
    .order("uploaded_at", { ascending: true })
    .limit(opts.limit ?? 10);
  if (error) throw new Error(`file read failed: ${error.message}`);
  if (!deps.scanner) {
    result.waiting = data.length;
    return result;
  }
  for (const file of data as FileRow[]) {
    const bytes = await deps.storage.read(file.storage_key);
    if (!bytes) {
      await discard(deps, file, "failed");
      result.rejected++;
      continue;
    }
    try {
      const status = await scanAndRecord(deps, file, bytes);
      if (status.status === "ready") result.clean++;
      else result.waiting++;
    } catch (rejection) {
      if (!(rejection instanceof MortgageApiError)) throw rejection;
      result.rejected++;
      if (file.document_id) await logRejectedAttachedFile(deps, file, rejection.code);
    }
  }
  return result;
}

/** A file already on a request (a Phase 5 re-upload) that failed its scan goes on the request's log. */
async function logRejectedAttachedFile(deps: DraftDeps, file: FileRow, code: string): Promise<void> {
  const { data } = await deps.db.from("mortgage_documents").select("request_id").eq("id", file.document_id!).maybeSingle();
  if (!data) return;
  await deps.db.rpc("mortgage_log_event", {
    p_request_id: data.request_id,
    p_type: "file.scan_failed",
    p_data: { file_id: file.id, kind: file.kind, code },
    p_actor_kind: "system",
  });
}

/**
 * Delete drafts nobody submitted within 24 hours, with their files and
 * objects. Supabase Storage has no lifecycle rules, so this does their job.
 */
export async function purgeExpiredDrafts(
  deps: DraftDeps,
  opts: { limit?: number } = {},
): Promise<{ drafts: number; files: number }> {
  const { data: drafts, error } = await deps.db
    .from("mortgage_upload_drafts")
    .select("id")
    .is("claimed_request_id", null)
    .lt("expires_at", nowOf(deps).toISOString())
    .order("expires_at", { ascending: true })
    .limit(opts.limit ?? 50);
  if (error) throw new Error(`draft read failed: ${error.message}`);
  const ids = (drafts as { id: string }[]).map((d) => d.id);
  if (ids.length === 0) return { drafts: 0, files: 0 };

  const { data: files, error: filesError } = await deps.db
    .from("mortgage_files")
    .select("id, storage_key")
    .in("draft_id", ids)
    .is("document_id", null);
  if (filesError) throw new Error(`file read failed: ${filesError.message}`);
  const rows = files as { id: string; storage_key: string }[];

  await deps.storage.remove(rows.map((f) => f.storage_key));
  if (rows.length > 0) {
    const { error: deleteFilesError } = await deps.db
      .from("mortgage_files")
      .delete()
      .in("id", rows.map((f) => f.id));
    if (deleteFilesError) throw new Error(`file delete failed: ${deleteFilesError.message}`);
  }
  const { error: deleteDraftsError } = await deps.db
    .from("mortgage_upload_drafts")
    .delete()
    .in("id", ids)
    .is("claimed_request_id", null);
  if (deleteDraftsError) throw new Error(`draft delete failed: ${deleteDraftsError.message}`);
  return { drafts: ids.length, files: rows.length };
}
