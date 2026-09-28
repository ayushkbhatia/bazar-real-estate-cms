import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftDeps, FileRow } from "./drafts";
import { MortgageApiError, notFound } from "./errors";
import type { ScanVerdict } from "./scan";
import { inspectPdf, sha256Hex, sniffMime } from "./verify";

/**
 * A bank's pre-approval letter (C5's "Record response"): the PDF the
 * applicant is sent with their pre-approval. It lives in the private bucket
 * like the applicant's documents, and goes through the same gate: its row is
 * made through the adviser's own session (`mortgage_letter_presign()`, 0149:
 * owner or Head, file with the banks), the bytes go straight to storage, and
 * nothing can use it until they are checked — a real PDF, at most 10 MB, no
 * password — and scanned clean.
 */

export const LETTER_MAX_BYTES = 10 * 1_048_576;

export type LetterStatus = { status: "ready"; fileId: string; name: string; sizeBytes: number } | { status: "scanning"; fileId: string };

/** Make the letter's row and a signed upload URL for its bytes. */
export async function presignLetter(
  deps: Pick<DraftDeps, "storage">,
  session: SupabaseClient,
  input: { submissionId: string; name: string; sizeBytes: number },
): Promise<{ fileId: string; uploadUrl: string; headers: Record<string, string> }> {
  if (input.sizeBytes > LETTER_MAX_BYTES) {
    throw new MortgageApiError(422, "too_large", undefined, { sizeBytes: input.sizeBytes, limitBytes: LETTER_MAX_BYTES });
  }
  const { data, error } = await session.rpc("mortgage_letter_presign", {
    p_submission_id: input.submissionId,
    p_name: input.name,
    p_size_bytes: input.sizeBytes,
  });
  if (error) {
    if (error.code === "MR403") throw new MortgageApiError(403, "forbidden");
    if (error.code === "MR404") throw notFound();
    if (error.code === "MR409") throw new MortgageApiError(409, "conflict");
    if (error.code === "MR422") throw new MortgageApiError(422, error.message.includes("too_large") ? "too_large" : "invalid");
    throw new Error(`letter presign failed: ${error.code}`);
  }
  const row = data as FileRow;
  const { url, headers } = await deps.storage.presignUpload(row.storage_key, "application/pdf");
  return { fileId: row.id, uploadUrl: url, headers };
}

/** Check and scan an uploaded letter. Throws the upload error for one that can't be used; its bytes are gone. */
export async function completeLetter(deps: DraftDeps, fileId: string): Promise<LetterStatus> {
  const { data } = await deps.db
    .from("mortgage_files")
    .select("id, bank_submission_id, state, storage_key, original_name, size_bytes, scan_status")
    .eq("id", fileId)
    .maybeSingle();
  const file = data as Pick<FileRow, "id" | "bank_submission_id" | "state" | "storage_key" | "original_name" | "size_bytes" | "scan_status"> | null;
  if (!file || !file.bank_submission_id || file.state === "removed") throw notFound();
  if (file.state === "active") {
    if (file.scan_status === "clean") return { status: "ready", fileId, name: file.original_name, sizeBytes: Number(file.size_bytes) };
    if (file.scan_status === "pending") return { status: "scanning", fileId };
    throw new MortgageApiError(422, "scan_failed");
  }

  const bytes = await deps.storage.read(file.storage_key);
  if (!bytes) throw new MortgageApiError(409, "upload_missing");
  const fail = async (code: "bad_type" | "too_large" | "encrypted_pdf" | "unreadable" | "infected" | "scan_failed") => {
    await discard(deps, file);
    return new MortgageApiError(422, code);
  };
  if (sniffMime(bytes) !== "application/pdf") throw await fail("bad_type");
  if (bytes.length > LETTER_MAX_BYTES) throw await fail("too_large");
  const pdf = await inspectPdf(bytes);
  if (!pdf.ok) throw await fail(pdf.reason);

  const { error } = await deps.db
    .from("mortgage_files")
    .update({ state: "active", size_bytes: bytes.length, page_count: pdf.pageCount, sha256: sha256Hex(bytes) })
    .eq("id", file.id)
    .eq("state", "pending");
  if (error) throw new Error(`letter update failed: ${error.message}`);

  if (!deps.scanner) return { status: "scanning", fileId };
  let verdict: ScanVerdict;
  try {
    verdict = await deps.scanner.scan(bytes);
  } catch {
    verdict = "unavailable";
  }
  if (verdict === "unavailable") return { status: "scanning", fileId };
  if (verdict !== "clean") throw await fail(verdict === "infected" ? "infected" : "scan_failed");
  const { error: cleanError } = await deps.db
    .from("mortgage_files")
    .update({ scan_status: "clean" })
    .eq("id", file.id)
    .eq("scan_status", "pending");
  if (cleanError) throw new Error(`letter update failed: ${cleanError.message}`);
  return { status: "ready", fileId, name: file.original_name, sizeBytes: bytes.length };
}

async function discard(deps: Pick<DraftDeps, "db" | "storage">, file: { id: string; storage_key: string }) {
  await deps.storage.remove([file.storage_key]).catch(() => undefined);
  await deps.db.from("mortgage_files").update({ state: "removed", scan_status: "failed" }).eq("id", file.id);
}
