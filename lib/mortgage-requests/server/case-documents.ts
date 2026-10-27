import "server-only";
import { CASE_DOCUMENT_MAX_BYTES, isCaseDocumentMime } from "../case-documents";
import { inspectPdf, sha256Hex, sniffMime } from "./verify";

/**
 * The checks on a case document's stored bytes, as on an applicant's: its
 * real type (not the one the browser declared), its real size, and a PDF that
 * opens without a password.
 */
export async function checkCaseDocumentBytes(
  bytes: Uint8Array,
): Promise<{ ok: true; sha256: string; pageCount: number | null } | { ok: false; reason: string }> {
  const mime = sniffMime(bytes);
  if (!mime || !isCaseDocumentMime(mime)) return { ok: false, reason: "bad_type" };
  if (bytes.length > CASE_DOCUMENT_MAX_BYTES) return { ok: false, reason: "too_large" };
  let pageCount: number | null = null;
  if (mime === "application/pdf") {
    const pdf = await inspectPdf(bytes);
    if (!pdf.ok) return { ok: false, reason: pdf.reason };
    pageCount = pdf.pageCount;
  }
  return { ok: true, sha256: sha256Hex(bytes), pageCount };
}
