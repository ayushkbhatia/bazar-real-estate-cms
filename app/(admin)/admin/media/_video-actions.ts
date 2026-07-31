"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  MAX_VIDEO_UPLOAD_BYTES,
  MEDIA_BUCKET,
  VIDEO_MIME,
  mediaPublicUrl,
  megabytes,
  storageKey,
} from "@/lib/media";
import {
  finaliseVideoUploadSchema,
  videoUploadTicketSchema,
  type FinaliseVideoUploadInput,
  type VideoUploadTicketInput,
} from "@/lib/schemas/media-upload";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * Direct-to-Storage upload for the hero video.
 *
 * `uploadMedia` (./_actions.ts) streams the file through the server action, so
 * it inherits `next.config.ts`'s 12 MB `serverActions.bodySizeLimit` — global,
 * with no per-action override — plus whatever ceiling the host puts on request
 * bodies, plus a full `Buffer` of the file in serverless memory. A 25 MB video
 * clears none of that.
 *
 * So the bytes skip the server entirely: `createVideoUploadTicket` mints a
 * short-lived signed upload URL, the browser PUTs straight to Supabase Storage,
 * and `finaliseVideoUpload` records the `media_assets` row afterwards. The row
 * is what the CMS stores a reference to, so the asset stays visible to the
 * media library's usage index exactly like an image.
 *
 * Video-capable roles match the media library's, minus `agent` — a hero video
 * is site chrome, not listing content.
 */
const VIDEO_ROLES = ["admin", "editor", "marketing"] as const;

export type VideoTicketResult =
  | { status: "ok"; storage_key: string; upload_url: string; token: string }
  | { status: "error"; message: string };

export type VideoFinaliseResult =
  | { status: "ok"; id: string; url: string; mime: string }
  | { status: "error"; message: string };

/** Keys this action mints always look like `brand/<uuid>-<safe-name>`. */
const VIDEO_FOLDER = "brand" as const;

function isMintedKey(key: string): boolean {
  return new RegExp(
    `^${VIDEO_FOLDER}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-`,
  ).test(key);
}

export async function createVideoUploadTicket(
  input: VideoUploadTicketInput,
): Promise<VideoTicketResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(VIDEO_ROLES);

  const parsed = videoUploadTicketSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "That video can't be uploaded.",
    };

  // Belt and braces: the schema enum and this set are declared separately, and
  // the set is what every other MIME decision in the app reads.
  if (!VIDEO_MIME.has(parsed.data.mime))
    return {
      status: "error",
      message: `Unsupported video type "${parsed.data.mime}". Use MP4 or WebM.`,
    };

  const key = storageKey({
    folder: VIDEO_FOLDER,
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

export async function finaliseVideoUpload(
  input: FinaliseVideoUploadInput,
): Promise<VideoFinaliseResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(VIDEO_ROLES);

  const parsed = finaliseVideoUploadSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Couldn't record the upload.",
    };

  const { storage_key, filename, mime, size_bytes } = parsed.data;

  // Only keys this action minted may be recorded, so a caller can't point a
  // media_assets row at an arbitrary object elsewhere in the bucket.
  if (!isMintedKey(storage_key))
    return { status: "error", message: "That upload wasn't started here." };

  const supabase = await createSupabaseServerClient();

  // The signed URL is scoped to one key, but its size is enforced by the
  // bucket, not by us — so confirm what actually landed before recording it.
  const { data: listed } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(VIDEO_FOLDER, {
      limit: 1,
      search: storage_key.slice(VIDEO_FOLDER.length + 1),
    });
  const object = listed?.[0];
  if (!object)
    return {
      status: "error",
      message: "The upload didn't complete — nothing landed in storage.",
    };

  const actualSize = (object.metadata as { size?: number } | null)?.size;
  if (typeof actualSize === "number" && actualSize > MAX_VIDEO_UPLOAD_BYTES) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storage_key]);
    return {
      status: "error",
      message: `Video is too large — keep it under ${megabytes(MAX_VIDEO_UPLOAD_BYTES)} MB.`,
    };
  }

  const insert = await supabase
    .from("media_assets")
    .insert({
      filename,
      mime_type: mime,
      size_bytes: actualSize ?? size_bytes,
      storage_key,
      alt_text: null,
      folder: VIDEO_FOLDER,
    })
    .select("id, storage_key")
    .maybeSingle();

  if (insert.error || !insert.data) {
    // Same rollback discipline as uploadMedia: an orphaned object nothing
    // references is invisible and billable, a row without an object is not.
    await supabase.storage.from(MEDIA_BUCKET).remove([storage_key]);
    return {
      status: "error",
      message:
        insert.error?.message ?? "Failed to record the upload in the database.",
    };
  }

  await logAudit({
    action: "media.upload_video",
    target_kind: "media_asset",
    target_id: insert.data.id,
    before: null,
    after: { filename, mime, size_bytes: actualSize ?? size_bytes },
  });

  revalidatePath("/admin/media");
  return {
    status: "ok",
    id: insert.data.id,
    url: mediaPublicUrl(insert.data.storage_key),
    mime,
  };
}
