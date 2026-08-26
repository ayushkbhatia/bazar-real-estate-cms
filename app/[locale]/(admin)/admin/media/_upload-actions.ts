"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  MEDIA_BUCKET,
  UPLOAD_POLICIES,
  isMintedKey,
  mediaPublicUrl,
  megabytes,
  storageKey,
  type UploadKind,
} from "@/lib/media";
import {
  finaliseUploadSchema,
  uploadTicketSchema,
  type FinaliseUploadInput,
  type UploadTicketInput,
} from "@/lib/schemas/media-upload";
import { requireRole } from "@/lib/auth";
import type { StaffRole } from "@/lib/schemas/staff";
import { logAudit } from "@/lib/audit";

/**
 * Direct-to-Storage upload, used by every control that adds a file.
 *
 * The bytes never touch the Next server. `createUploadTicket` mints a
 * short-lived signed upload URL, the browser PUTs straight to Supabase
 * Storage, and `finaliseUpload` records the `media_assets` row afterwards.
 *
 * This is not an optimisation, it is the only transport that works. A server
 * action's payload is a Vercel Function request body, and Vercel refuses those
 * over 4.5 MB with `413 FUNCTION_PAYLOAD_TOO_LARGE` — the function never runs,
 * so the app cannot catch it or explain it. That cap does not exist on a dev
 * machine, which is why streaming uploads through an action looked fine in
 * development and failed for the admin team on anything off a modern camera.
 * See lib/media.ts.
 *
 * The `media_assets` row is what the CMS stores a reference to, so an asset
 * uploaded this way stays visible to the media library's usage index exactly
 * as one uploaded through the library itself.
 */

/**
 * Video is site chrome, not listing content — advisors don't place it. A font
 * is narrower still: it restyles every Arabic page at once, and /admin/settings
 * is already admin-only, so the upload behind it matches that gate rather than
 * being the one door into the screen that anyone can push.
 */
const ROLES: Record<UploadKind, ReadonlyArray<StaffRole>> = {
  standard: ["admin", "editor", "marketing", "agent"],
  hero_video: ["admin", "editor", "marketing"],
  font: ["admin"],
};

export type UploadTicketResult =
  | { status: "ok"; storage_key: string; upload_url: string; token: string }
  | { status: "error"; message: string };

export type UploadFinaliseResult =
  | {
      status: "ok";
      id: string;
      storage_key: string;
      filename: string;
      url: string;
      mime: string;
    }
  | { status: "error"; message: string };

export async function createUploadTicket(
  input: UploadTicketInput,
): Promise<UploadTicketResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const parsed = uploadTicketSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "That file can't be uploaded.",
    };

  await requireRole(ROLES[parsed.data.kind]);

  const key = storageKey({
    folder: parsed.data.folder,
    filename: parsed.data.filename,
    uuid: randomUUID(),
  });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(key);

  if (error || !data)
    return {
      status: "error",
      message: `Couldn't start the upload: ${error?.message ?? "unknown error"}`,
    };

  return {
    status: "ok",
    storage_key: key,
    upload_url: data.signedUrl,
    token: data.token,
  };
}

export async function finaliseUpload(
  input: FinaliseUploadInput,
): Promise<UploadFinaliseResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const parsed = finaliseUploadSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Couldn't record the upload.",
    };

  const { storage_key, filename, mime, size_bytes, folder, kind, alt_text } =
    parsed.data;
  await requireRole(ROLES[kind]);

  if (!isMintedKey(storage_key, folder))
    return { status: "error", message: "That upload wasn't started here." };

  const supabase = await createSupabaseServerClient();

  // The signed URL is scoped to one key, but its size is enforced by the
  // bucket, not by us — so confirm what actually landed before recording it.
  const { data: listed } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(folder, { limit: 1, search: storage_key.slice(folder.length + 1) });
  const object = listed?.[0];
  if (!object)
    return {
      status: "error",
      message: "The upload didn't complete — nothing landed in storage.",
    };

  const maxBytes = UPLOAD_POLICIES[kind].maxBytes;
  const actualSize = (object.metadata as { size?: number } | null)?.size;
  if (typeof actualSize === "number" && actualSize > maxBytes) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storage_key]);
    return {
      status: "error",
      message: `"${filename}" is ${megabytes(actualSize)} MB — keep it under ${megabytes(maxBytes)} MB.`,
    };
  }

  const insert = await supabase
    .from("media_assets")
    .insert({
      filename,
      mime_type: mime,
      size_bytes: actualSize ?? size_bytes,
      storage_key,
      alt_text: alt_text ?? null,
      folder,
    })
    .select("id, storage_key")
    .maybeSingle();

  if (insert.error || !insert.data) {
    // An orphaned object nothing references is invisible and billable; a row
    // without an object is neither. Roll the object back.
    await supabase.storage.from(MEDIA_BUCKET).remove([storage_key]);
    return {
      status: "error",
      message:
        insert.error?.message ?? "Failed to record the upload in the database.",
    };
  }

  await logAudit({
    action: kind === "hero_video" ? "media.upload_video" : "media.upload",
    target_kind: "media_asset",
    target_id: insert.data.id,
    before: null,
    after: { filename, mime, folder, size_bytes: actualSize ?? size_bytes },
  });

  revalidatePath("/admin/media");
  return {
    status: "ok",
    id: insert.data.id,
    storage_key: insert.data.storage_key,
    filename,
    url: mediaPublicUrl(insert.data.storage_key),
    mime,
  };
}
