import { env } from "@/lib/env";

export const MEDIA_BUCKET = "media";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "application/pdf",
]);

/**
 * Public URL for an object in the media bucket.
 * Works at build + render time without a Supabase client roundtrip.
 */
export function mediaPublicUrl(storage_key: string): string {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${storage_key}`;
}

/** Sanitise a filename to a Storage-safe path segment.
 *  Rules:
 *   - lowercase
 *   - collapse anything other than a-z0-9_- (including internal dots) to '-'
 *   - trim leading/trailing '-'
 *   - keep the trailing extension (after the last dot) intact, max 8 chars
 *   - empty stems fall back to 'file'
 */
export function safeFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const hasExt = dot >= 0 && dot < filename.length - 1;
  const rawStem = hasExt ? filename.slice(0, dot) : filename;
  const stem = rawStem
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const ext = hasExt
    ? filename
        .slice(dot + 1)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 8)
    : "";
  const safeStem = stem || "file";
  return ext ? `${safeStem}.${ext}` : safeStem;
}

/** Build a storage key under a given folder + a random uuid suffix. */
export function storageKey(opts: {
  folder: "listings" | "brand" | "blog" | "team" | "documents";
  filename: string;
  uuid: string;
}): string {
  return `${opts.folder}/${opts.uuid}-${safeFilename(opts.filename)}`;
}
