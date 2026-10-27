"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import {
  CASE_DOCUMENTS_MAX,
  CASE_DOCUMENT_DESCRIPTION_MAX,
  CASE_DOCUMENT_MAX_BYTES,
  CASE_DOCUMENT_TITLE_MAX,
  isCaseDocumentMime,
  NOTE_MAX,
} from "@/lib/mortgage-requests/case-documents";
import { checkCaseDocumentBytes } from "@/lib/mortgage-requests/server/case-documents";
import {
  FAILED,
  INVALID,
  NOT_ALLOWED,
  refreshMortgagePaths,
  refused,
  targetSchema,
  teamSession,
  type MortgageActionResult,
} from "@/lib/mortgage-requests/server/cms-kit";
import { fileKey, supabaseStorage } from "@/lib/mortgage-requests/server/storage";

/**
 * Internal notes and case documents on a request's file page (0171, client,
 * Oct 2026). Every write is a SQL function called through the adviser's own
 * session, so the database decides who may act: the owner or the Head.
 *
 * A case document's file goes straight from the browser to the private bucket
 * through a signed URL (a Vercel function would refuse anything over 4.5 MB),
 * then `completeCaseDocument` reads the stored bytes back and checks them
 * before the file goes live, as an applicant's upload is checked.
 */

const t = cmsT;

// ── Notes ─────────────────────────────────────────────────────────

const noteSchema = targetSchema.extend({ body: z.string().trim().min(1).max(NOTE_MAX) });

export async function addMortgageNote(input: unknown): Promise<MortgageActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: t("common.failed"), fields: ["body"] };
  const b = parsed.data;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const { error } = await s.supabase.rpc("mortgage_add_note", {
    p_request_id: b.requestId,
    p_body: b.body,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.note");
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("internal.notes.saved") };
}

// ── Case documents ────────────────────────────────────────────────

const startSchema = targetSchema.extend({
  title: z.string().trim().min(1).max(CASE_DOCUMENT_TITLE_MAX),
  description: z.string().trim().max(CASE_DOCUMENT_DESCRIPTION_MAX).optional().default(""),
  fileName: z.string().trim().min(1).max(200),
  mime: z.string().refine(isCaseDocumentMime),
  sizeBytes: z.number().int().positive().max(CASE_DOCUMENT_MAX_BYTES),
});

export type StartCaseDocumentResult =
  | { ok: true; fileId: string; caseDocumentId: string; url: string; headers: Record<string, string> }
  | Exclude<MortgageActionResult, { ok: true }>;

/** Create the document and its pending file, and hand back where to upload the bytes. */
export async function startCaseDocument(input: unknown): Promise<StartCaseDocumentResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => String(i.path[0]));
    const fileProblem = fields.some((f) => f === "mime" || f === "sizeBytes");
    return { ok: false, code: "invalid", message: fileProblem ? t("internal.docs.badFile") : t("common.failed"), fields };
  }
  const b = parsed.data;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED as Exclude<MortgageActionResult, { ok: true }>;
  const admin = createAdminClient();
  if (!admin) return FAILED as Exclude<MortgageActionResult, { ok: true }>;

  const fileId = randomUUID();
  const { data, error } = await s.supabase.rpc("mortgage_add_case_document", {
    p_request_id: b.requestId,
    p_title: b.title,
    p_description: b.description,
    p_file_id: fileId,
    p_original_name: b.fileName,
    p_mime: b.mime,
    p_size_bytes: b.sizeBytes,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) {
    if (error.code === "MR422" && /at most 10/.test(error.message)) {
      return { ok: false, code: "invalid", message: t("internal.docs.full", { max: String(CASE_DOCUMENTS_MAX) }) };
    }
    return refused(error, "mortgage.cms.case_document") as Exclude<MortgageActionResult, { ok: true }>;
  }
  const doc = data as { id: string };
  const { url, headers } = await supabaseStorage(admin).presignUpload(fileKey(fileId), b.mime);
  return { ok: true, fileId, caseDocumentId: doc.id, url, headers };
}

const completeSchema = z.object({
  reference: targetSchema.shape.reference,
  caseDocumentId: z.string().uuid(),
  fileId: z.string().uuid(),
});

/**
 * Check the uploaded bytes and put the file live. A file that fails the
 * checks takes its document with it (removed, its object deleted), so a bad
 * upload never sits on the page.
 */
export async function completeCaseDocument(input: unknown): Promise<MortgageActionResult> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const b = parsed.data;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const admin = createAdminClient();
  if (!admin) return FAILED;
  const storage = supabaseStorage(admin);

  // Only a pending file of this document, which this caller could see.
  const { data: file } = await s.supabase
    .from("mortgage_files")
    .select("id, state, case_document_id")
    .eq("id", b.fileId)
    .eq("case_document_id", b.caseDocumentId)
    .maybeSingle();
  if (!file || (file as { state: string }).state !== "pending") return INVALID;

  const bytes = await storage.read(fileKey(b.fileId));
  const check = bytes ? await checkCaseDocumentBytes(bytes) : ({ ok: false, reason: "missing" } as const);
  if (!check.ok) {
    const { data: removed } = await s.supabase.rpc("mortgage_remove_case_document", {
      p_case_document_id: b.caseDocumentId,
    });
    await storage.remove(((removed ?? []) as { storage_key: string }[]).map((f) => f.storage_key));
    refreshMortgagePaths(b.reference);
    return { ok: false, code: "invalid", message: t("internal.docs.badFile") };
  }

  const { error } = await admin.rpc("mortgage_complete_case_document", {
    p_file_id: b.fileId,
    p_sha256: check.sha256,
    p_page_count: check.pageCount ?? undefined,
  });
  if (error) return refused(error, "mortgage.cms.case_document_complete");
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("internal.docs.saved") };
}

const removeSchema = targetSchema.extend({ caseDocumentId: z.string().uuid() });

/** Remove a case document; its file is retired in the database, then deleted from the bucket. */
export async function removeCaseDocument(input: unknown): Promise<MortgageActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const b = parsed.data;
  const s = await teamSession();
  if (!s) return NOT_ALLOWED;
  const admin = createAdminClient();
  if (!admin) return FAILED;

  const { data, error } = await s.supabase.rpc("mortgage_remove_case_document", {
    p_case_document_id: b.caseDocumentId,
    p_expected_updated_at: b.updatedAt,
  });
  if (error) return refused(error, "mortgage.cms.case_document_remove");
  // Retired in the database first; a failed delete here leaves an object that
  // nothing points at, which retention sweeps rather than a live file.
  await supabaseStorage(admin)
    .remove(((data ?? []) as { storage_key: string }[]).map((f) => f.storage_key))
    .catch(() => undefined);
  refreshMortgagePaths(b.reference);
  return { ok: true, message: t("internal.docs.removed") };
}
