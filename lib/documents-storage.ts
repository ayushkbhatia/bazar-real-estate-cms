import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  DocumentKind,
  DocumentOwnerKind,
} from "@/lib/deals";
import { composeDocumentStorageKey } from "@/lib/deals";

export const DOCUMENTS_BUCKET = "documents";
/** 15-minute TTL for signed URLs — never longer; never publish raw URLs. */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB per document.
export const ALLOWED_DOCUMENT_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type SignResult =
  | { status: "ok"; url: string; expiresAt: string }
  | { status: "error"; message: string };

/**
 * Short-lived signed URL for downloading a document. The caller is
 * responsible for verifying the requester is allowed to see this row
 * (via RLS / canViewDocument) before invoking — this function does not
 * re-check permissions.
 */
export async function signDocumentDownload(
  storageKey: string,
): Promise<SignResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Supabase env not configured." };
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      status: "error",
      message: "Service role key missing — cannot mint signed URL.",
    };
  }
  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return {
      status: "error",
      message: error?.message ?? "Failed to sign URL.",
    };
  }
  const expiresAt = new Date(
    Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  ).toISOString();
  return { status: "ok", url: data.signedUrl, expiresAt };
}

export type SignedUploadResult =
  | {
      status: "ok";
      uploadUrl: string;
      token: string;
      documentId: string;
      storageKey: string;
    }
  | { status: "error"; message: string };

/**
 * Create a buyer-side account document upload: row + signed PUT URL.
 * Browser PUTs the file to `uploadUrl`; row already exists in `uploaded`
 * status with the storage_key pointing at the same key.
 */
export async function createAccountDocumentUpload(opts: {
  ownerUserId: string;
  kind: DocumentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<SignedUploadResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Supabase env not configured." };
  }
  if (opts.sizeBytes <= 0 || opts.sizeBytes > MAX_DOCUMENT_BYTES) {
    return {
      status: "error",
      message: `File must be 1–${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.`,
    };
  }
  if (!ALLOWED_DOCUMENT_MIME.has(opts.mimeType)) {
    return {
      status: "error",
      message: `Unsupported file type. Accepted: PDF, JPEG, PNG, WEBP, HEIC.`,
    };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== opts.ownerUserId) {
    return { status: "error", message: "Sign-in required." };
  }

  const { data: row, error: insertErr } = await supabase
    .from("documents")
    .insert({
      owner_kind: "account",
      owner_id: opts.ownerUserId,
      kind: opts.kind,
      status: "uploaded",
      uploaded_by: user.id,
      filename: opts.filename,
      mime_type: opts.mimeType,
      size_bytes: opts.sizeBytes,
    })
    .select("id")
    .maybeSingle();
  if (insertErr || !row) {
    return {
      status: "error",
      message: insertErr?.message ?? "Could not create document row.",
    };
  }

  const storageKey = composeDocumentStorageKey({
    ownerKind: "account",
    ownerId: opts.ownerUserId,
    documentId: row.id,
    filename: opts.filename,
  });

  await supabase
    .from("documents")
    .update({ storage_key: storageKey })
    .eq("id", row.id);

  const admin = createAdminClient();
  if (!admin) {
    return {
      status: "error",
      message: "Service role key missing — cannot mint upload URL.",
    };
  }
  const { data: signed, error: signErr } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(storageKey);
  if (signErr || !signed?.signedUrl) {
    return {
      status: "error",
      message: signErr?.message ?? "Failed to sign upload URL.",
    };
  }

  return {
    status: "ok",
    uploadUrl: signed.signedUrl,
    token: signed.token,
    documentId: row.id,
    storageKey,
  };
}

/**
 * Staff-only: deal-scoped document upload. Same shape as the account
 * variant but writes the row + the storage object under deals/<deal_id>/.
 */
export async function createDealDocumentUpload(opts: {
  dealId: string;
  kind: DocumentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<SignedUploadResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Supabase env not configured." };
  }
  if (opts.sizeBytes <= 0 || opts.sizeBytes > MAX_DOCUMENT_BYTES) {
    return {
      status: "error",
      message: `File must be 1–${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.`,
    };
  }
  if (!ALLOWED_DOCUMENT_MIME.has(opts.mimeType)) {
    return { status: "error", message: "Unsupported file type." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign-in required." };

  const { data: row, error: insertErr } = await supabase
    .from("documents")
    .insert({
      owner_kind: "deal",
      owner_id: opts.dealId,
      kind: opts.kind,
      status: "uploaded",
      uploaded_by: user.id,
      filename: opts.filename,
      mime_type: opts.mimeType,
      size_bytes: opts.sizeBytes,
    })
    .select("id")
    .maybeSingle();
  if (insertErr || !row) {
    return {
      status: "error",
      message:
        insertErr?.message ?? "Could not create document row (staff only).",
    };
  }
  const storageKey = composeDocumentStorageKey({
    ownerKind: "deal",
    ownerId: opts.dealId,
    documentId: row.id,
    filename: opts.filename,
  });
  await supabase
    .from("documents")
    .update({ storage_key: storageKey })
    .eq("id", row.id);

  const admin = createAdminClient();
  if (!admin) {
    return { status: "error", message: "Service role key missing." };
  }
  const { data: signed, error: signErr } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(storageKey);
  if (signErr || !signed?.signedUrl) {
    return {
      status: "error",
      message: signErr?.message ?? "Failed to sign upload URL.",
    };
  }
  return {
    status: "ok",
    uploadUrl: signed.signedUrl,
    token: signed.token,
    documentId: row.id,
    storageKey,
  };
}

/**
 * Permission gate for the download endpoint — mirrors canViewDocument from
 * lib/deals.ts but skips the {} discriminated-union spelling that's
 * inconvenient on the server.
 */
export function canSignDownload(opts: {
  ownerKind: DocumentOwnerKind;
  ownerId: string;
  viewerUserId: string | null;
  viewerIsStaff: boolean;
  viewerBuyerOfDealId: string | null;
}): boolean {
  if (opts.viewerIsStaff) return true;
  if (!opts.viewerUserId) return false;
  if (opts.ownerKind === "account" && opts.ownerId === opts.viewerUserId)
    return true;
  if (
    opts.ownerKind === "deal" &&
    opts.viewerBuyerOfDealId &&
    opts.ownerId === opts.viewerBuyerOfDealId
  )
    return true;
  return false;
}
