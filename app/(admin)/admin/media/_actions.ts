"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  storageKey,
} from "@/lib/media";
import { requireRole } from "@/lib/auth";

const MEDIA_ROLES = ["admin", "editor", "marketing", "agent"] as const;

export type UploadResult =
  | { status: "ok"; id: string; storage_key: string }
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
  };
}
