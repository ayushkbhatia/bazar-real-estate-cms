import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DraftDeps, FileRow } from "./drafts";
import { MortgageApiError, notFound } from "./errors";
import { inspectPdf, sha256Hex, sniffMime } from "./verify";

/**
 * A bank's pre-approval letter (C5's "Record response"): the PDF the
 * applicant is sent with their pre-approval. It lives in the private bucket
 * like the applicant's documents, and goes through the same gate: its row is
 * made through the adviser's own session (`mortgage_letter_presign()`, 0149:
 * owner or Head, file with the banks), the bytes go straight to storage, and
 * nothing can use it until they are checked — a real PDF, at most 10 MB, no
 * password. There is no malware scan (decision D6).
 */

export const LETTER_MAX_BYTES = 10 * 1_048_576;

export type LetterStatus = { status: "ready"; fileId: string; name: string; sizeBytes: number };

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

/** Check an uploaded letter. Throws the upload error for one that can't be used; its bytes are gone. */
export async function completeLetter(deps: DraftDeps, fileId: string): Promise<LetterStatus> {
  const { data } = await deps.db
    .from("mortgage_files")
    .select("id, bank_submission_id, state, storage_key, original_name, size_bytes")
    .eq("id", fileId)
    .maybeSingle();
  const file = data as Pick<FileRow, "id" | "bank_submission_id" | "state" | "storage_key" | "original_name" | "size_bytes"> | null;
  if (!file || !file.bank_submission_id || file.state === "removed") throw notFound();
  if (file.state === "active") return { status: "ready", fileId, name: file.original_name, sizeBytes: Number(file.size_bytes) };

  const bytes = await deps.storage.read(file.storage_key);
  if (!bytes) throw new MortgageApiError(409, "upload_missing");
  const fail = async (code: "bad_type" | "too_large" | "encrypted_pdf" | "unreadable") => {
    await discard(deps, file);
    return new MortgageApiError(422, code);
  };
  if (sniffMime(bytes) !== "application/pdf") throw await fail("bad_type");
  if (bytes.length > LETTER_MAX_BYTES) throw await fail("too_large");
  const pdf = await inspectPdf(bytes);
  if (!pdf.ok) throw await fail(pdf.reason);

  // `clean` is what the database's gates read as "passed its checks" (decision D6).
  const { error } = await deps.db
    .from("mortgage_files")
    .update({ state: "active", scan_status: "clean", size_bytes: bytes.length, page_count: pdf.pageCount, sha256: sha256Hex(bytes) })
    .eq("id", file.id)
    .eq("state", "pending");
  if (error) throw new Error(`letter update failed: ${error.message}`);
  return { status: "ready", fileId, name: file.original_name, sizeBytes: bytes.length };
}

async function discard(deps: Pick<DraftDeps, "db" | "storage">, file: { id: string; storage_key: string }) {
  await deps.storage.remove([file.storage_key]).catch(() => undefined);
  await deps.db.from("mortgage_files").update({ state: "removed" }).eq("id", file.id);
}
