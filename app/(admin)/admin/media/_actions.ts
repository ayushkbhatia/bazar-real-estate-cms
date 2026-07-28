"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  mediaPublicUrl,
  storageKey,
} from "@/lib/media";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildMediaUsageIndex } from "@/lib/queries/media-usage";
import { summariseUsage } from "@/lib/media-usage";

const MEDIA_ROLES = ["admin", "editor", "marketing", "agent"] as const;
/** Permanently destroying a file is admin-only — trashing isn't. */
const MEDIA_DESTROY_ROLES = ["admin"] as const;

export type UploadResult =
  | { status: "ok"; id: string; storage_key: string; url: string }
  | { status: "error"; message: string };

const FOLDERS = new Set(["listings", "brand", "blog", "team", "documents"]);

export async function uploadMedia(formData: FormData): Promise<UploadResult> {
  if (!isSupabaseConfigured)
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };
  await requireRole(MEDIA_ROLES);

  const file = formData.get("file");
  if (!(file instanceof File))
    return { status: "error", message: "No file selected." };

  if (file.size === 0)
    return { status: "error", message: "File is empty." };
  if (file.size > MAX_UPLOAD_BYTES)
    return {
      status: "error",
      message: `File too large — max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    };

  if (!ALLOWED_MIME.has(file.type))
    return {
      status: "error",
      message: `Unsupported file type "${file.type}". Use JPG, PNG, WebP, AVIF, GIF, or PDF.`,
    };

  const folderRaw = String(formData.get("folder") ?? "listings");
  const folder = (FOLDERS.has(folderRaw) ? folderRaw : "listings") as
    | "listings"
    | "brand"
    | "blog"
    | "team"
    | "documents";

  const altText = (() => {
    const raw = formData.get("alt_text");
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  })();

  const uuid = randomUUID();
  const key = storageKey({ folder, filename: file.name, uuid });

  const supabase = await createSupabaseServerClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  // Try to detect image dimensions for nicer rendering. For PDFs and non-image
  // mimes we leave width/height null.
  const upload = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(key, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (upload.error) {
    return { status: "error", message: `Upload failed: ${upload.error.message}` };
  }

  const insert = await supabase
    .from("media_assets")
    .insert({
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_key: key,
      alt_text: altText,
      folder,
    })
    .select("id, storage_key")
    .maybeSingle();

  if (insert.error || !insert.data) {
    // Roll back the storage object if the DB insert failed.
    await supabase.storage.from(MEDIA_BUCKET).remove([key]);
    return {
      status: "error",
      message:
        insert.error?.message ?? "Failed to record the upload in the database.",
    };
  }

  revalidatePath("/admin/media");
  return {
    status: "ok",
    id: insert.data.id,
    storage_key: insert.data.storage_key,
    // Returned so callers that upload from elsewhere (the master-page image
    // fields) can preview the asset without waiting for a refresh.
    url: mediaPublicUrl(insert.data.storage_key),
  };
}

export type MediaMutationResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Re-check usage server-side before anything destructive. The UI already hides
 * the button for assets that are in use, but the button is a hint, not a
 * guarantee — someone else may have attached the file since the page rendered.
 */
async function assertUnused(
  asset: { id: string; storage_key: string },
): Promise<string | null> {
  const index = await buildMediaUsageIndex([asset]);
  if (index.partial) {
    return `Couldn't verify where this file is used (${index.failedSources.join(", ")} unavailable). Nothing was deleted.`;
  }
  const usages = index.byAsset.get(asset.id) ?? [];
  if (usages.length > 0) {
    return `Still in use — ${summariseUsage(usages)}. Detach it first.`;
  }
  return null;
}

async function loadAsset(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return { asset: null, message: error.message };
  if (!data) return { asset: null, message: "Asset not found." };
  return { asset: data, message: null };
}

/** Soft-delete: the row keeps its storage object so a restore is free. */
export async function trashMedia(id: string): Promise<MediaMutationResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEDIA_ROLES);

  const { asset, message } = await loadAsset(id);
  if (!asset) return { status: "error", message: message ?? "Asset not found." };
  if (asset.deleted_at)
    return { status: "error", message: "Already in the trash." };

  const blocked = await assertUnused(asset);
  if (blocked) return { status: "error", message: blocked };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not found, or your account is not allowed to change it.",
    };

  await logAudit({
    action: "media.trash",
    target_kind: "media_asset",
    target_id: id,
    before: { filename: asset.filename, deleted_at: null },
    after: { deleted_at: "now" },
  });
  revalidatePath("/admin/media");
  return { status: "ok", message: `"${asset.filename}" moved to trash.` };
}

export async function restoreMedia(id: string): Promise<MediaMutationResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEDIA_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id, filename")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return { status: "error", message: "Not in the trash any more." };

  await logAudit({
    action: "media.restore",
    target_kind: "media_asset",
    target_id: id,
    before: null,
    after: { filename: data.filename },
  });
  revalidatePath("/admin/media");
  return { status: "ok", message: `"${data.filename}" restored.` };
}

/**
 * Permanent delete: storage object first, then the row. Storage-first means a
 * failure halfway leaves a row pointing at a missing object (visible, fixable)
 * rather than an orphaned object nothing references (invisible, billable).
 */
export async function deleteMediaPermanently(
  id: string,
): Promise<MediaMutationResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEDIA_DESTROY_ROLES);

  const { asset, message } = await loadAsset(id);
  if (!asset) return { status: "error", message: message ?? "Asset not found." };
  if (!asset.deleted_at)
    return {
      status: "error",
      message: "Move it to the trash first.",
    };

  const blocked = await assertUnused(asset);
  if (blocked) return { status: "error", message: blocked };

  const supabase = await createSupabaseServerClient();
  const removal = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([asset.storage_key]);
  if (removal.error)
    return {
      status: "error",
      message: `Storage delete failed: ${removal.error.message}`,
    };

  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error)
    return {
      status: "error",
      message: `File removed from storage, but the record could not be deleted: ${error.message}`,
    };

  await logAudit({
    action: "media.delete",
    target_kind: "media_asset",
    target_id: id,
    before: { filename: asset.filename, storage_key: asset.storage_key },
    after: null,
  });
  revalidatePath("/admin/media");
  return { status: "ok", message: `"${asset.filename}" deleted for good.` };
}
