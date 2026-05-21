"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { createAccountDocumentUpload } from "@/lib/documents-storage";
import type { DocumentKind } from "@/lib/deals";

export type StartUploadResult =
  | {
      status: "ok";
      uploadUrl: string;
      token: string;
      documentId: string;
      storageKey: string;
    }
  | { status: "error"; message: string };

const ACCOUNT_KINDS: DocumentKind[] = [
  "passport",
  "emirates_id",
  "mortgage_pre_approval",
];

/**
 * Buyer-side: start an upload to accounts/<auth.uid()>/*. Returns the
 * signed PUT URL the browser uses, and records the row in `documents`.
 */
export async function startAccountDocumentUpload(input: {
  kind: DocumentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<StartUploadResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Service unavailable." };

  if (!ACCOUNT_KINDS.includes(input.kind)) {
    return {
      status: "error",
      message:
        "Only passport, Emirates ID, and mortgage pre-approval can be uploaded from your vault.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sign-in required." };

  const res = await createAccountDocumentUpload({
    ownerUserId: user.id,
    kind: input.kind,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
  if (res.status === "error") return res;

  await logAudit({
    action: "account.document_uploaded",
    target_kind: "document",
    target_id: res.documentId,
    before: null,
    after: {
      kind: input.kind,
      filename: input.filename,
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType,
    },
  });

  revalidatePath("/account/documents");
  return res;
}
