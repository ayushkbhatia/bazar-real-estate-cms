/**
 * Staff access to applicants' documents (docs/mortgage/SPEC.md §7–8): the
 * logic behind /api/admin/mortgages/files/[fileId].
 *
 * The order is the whole point:
 *   1. Only the mortgage team — an admin without a mortgage role gets 403 like
 *      everyone else (decision D10). The database re-checks when the event is
 *      written, so a bug here can't let an outsider leave no trace.
 *   2. Only files on a request, past their checks and clean.
 *   3. The `document.viewed` / `document.downloaded` event is written BEFORE a
 *      single byte is read. If the log write fails, nothing is returned.
 *   4. Then the bytes, with no-store headers (set by the route).
 *
 * The owner's first open of a request's document moves it from New to In
 * review (SPEC §2.4); that happens here because this is where opens happen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { MortgageApiError, notFound } from "./errors";
import type { MortgageStorage } from "./storage";
import type { FileRow } from "./drafts";

export type StaffCaller = {
  userId: string;
  status: string;
  mortgageRole: "head" | "adviser" | null;
} | null;

export type AccessEvent = {
  requestId: string;
  type: "document.viewed" | "document.downloaded";
  data: Record<string, unknown>;
};

export type FileAccessDeps = {
  /** Service-role client, for reading file rows and the owner's first-open move. */
  db: SupabaseClient;
  storage: MortgageStorage;
  /** Writes the access event as the caller, through their own session. */
  logAccess: (event: AccessEvent) => Promise<void>;
};

export type OpenedFile = { bytes: Uint8Array; mime: string; name: string; sizeBytes: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function openStaffFile(
  deps: FileAccessDeps,
  input: { caller: StaffCaller; fileId: string; download: boolean },
): Promise<OpenedFile> {
  const { caller } = input;
  if (!caller) throw new MortgageApiError(401, "unauthorised");
  if (caller.status !== "active" || !caller.mortgageRole) {
    throw new MortgageApiError(403, "forbidden");
  }
  if (!UUID.test(input.fileId)) throw notFound();

  const { data: file, error } = await deps.db
    .from("mortgage_files")
    .select("id, document_id, bank_submission_id, kind, state, storage_key, original_name, mime, size_bytes, scan_status")
    .eq("id", input.fileId)
    .maybeSingle();
  if (error) throw new Error(`file read failed: ${error.message}`);
  const row = file as Pick<
    FileRow,
    "id" | "document_id" | "bank_submission_id" | "kind" | "state" | "storage_key" | "original_name" | "mime" | "size_bytes" | "scan_status"
  > | null;
  // Draft files aren't on a request yet, and removed ones are gone.
  if (!row || row.state === "removed" || (!row.document_id && !row.bank_submission_id)) throw notFound();
  if (row.state !== "active" || row.scan_status !== "clean") {
    throw new MortgageApiError(409, "not_scanned");
  }

  const request = await requestOf(deps, row);
  if (!request) throw notFound();

  // Log first. A failure here returns an error and no bytes.
  await deps.logAccess({
    requestId: request.id,
    type: input.download ? "document.downloaded" : "document.viewed",
    data: { file_id: row.id, kind: row.kind ?? "bank_letter" },
  });

  if (
    row.document_id &&
    request.service === "pre_approval" &&
    request.status === "new" &&
    request.owner_staff_id === caller.userId
  ) {
    // Best effort: someone may have moved it a moment ago, which is fine.
    await deps.db.rpc("mortgage_transition", {
      p_request_id: request.id,
      p_event: "first_document_opened",
      p_actor_kind: "system",
    });
  }

  const bytes = await deps.storage.read(row.storage_key);
  if (!bytes) throw notFound();
  return { bytes, mime: row.mime, name: row.original_name, sizeBytes: bytes.length };
}

type RequestSummary = { id: string; service: string; status: string; owner_staff_id: string | null };

async function requestOf(
  deps: FileAccessDeps,
  row: { document_id: string | null; bank_submission_id: string | null },
): Promise<RequestSummary | null> {
  const parent = row.document_id
    ? await deps.db.from("mortgage_documents").select("request_id").eq("id", row.document_id).maybeSingle()
    : await deps.db.from("mortgage_bank_submissions").select("request_id").eq("id", row.bank_submission_id!).maybeSingle();
  const requestId = (parent.data as { request_id: string } | null)?.request_id;
  if (!requestId) return null;
  const { data } = await deps.db
    .from("mortgage_requests")
    .select("id, service, status, owner_staff_id")
    .eq("id", requestId)
    .maybeSingle();
  return (data as RequestSummary | null) ?? null;
}

/** `Content-Disposition` with the file's own name, safely encoded. */
export function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** The response for a staff file request: the bytes with no-store headers, or the error. */
export async function staffFileResponse(
  deps: FileAccessDeps,
  input: { caller: StaffCaller; fileId: string; download: boolean },
): Promise<Response> {
  try {
    const file = await openStaffFile(deps, input);
    return new Response(new Blob([file.bytes as BlobPart], { type: file.mime }), {
      status: 200,
      headers: {
        "content-type": file.mime,
        "content-length": String(file.sizeBytes),
        "content-disposition": contentDisposition(input.download ? "attachment" : "inline", file.name),
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        // The CMS viewer renders with pdf.js from the bytes; nothing in the file itself should run.
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof MortgageApiError) {
      return Response.json(error.toJSON(), {
        status: error.status,
        headers: { "cache-control": "no-store" },
      });
    }
    throw error;
  }
}
