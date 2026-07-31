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
 * Hero video gets its own, larger ceiling.
 *
 * It can afford one because it does not share the transport. Every other
 * upload posts its bytes to a server action, so it is capped by
 * `next.config.ts`'s `serverActions.bodySizeLimit` (12 MB, global — Next has
 * no per-action override) and by the host's own request-body limit long before
 * `MAX_UPLOAD_BYTES` gets a say. The hero video instead goes browser → Supabase
 * Storage on a signed URL, so none of those layers apply and the real ceiling
 * is the bucket's `file_size_limit` (set to 25 MB in migration 0070).
 *
 * Raising the bucket ceiling cannot loosen anything else: every other control
 * still runs through `uploadMedia`, which rejects >10 MB before a byte reaches
 * Storage.
 */
export const MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const VIDEO_MIME = new Set<string>(["video/mp4", "video/webm"]);

export type UploadKind = "standard" | "hero_video";

export type UploadPolicy = {
  maxBytes: number;
  mime: ReadonlySet<string>;
  /** Accepted-formats phrase, used verbatim in client + server error copy. */
  accepts: string;
};

export const UPLOAD_POLICIES: Record<UploadKind, UploadPolicy> = {
  standard: {
    maxBytes: MAX_UPLOAD_BYTES,
    mime: ALLOWED_MIME,
    accepts: "JPG, PNG, WebP, AVIF, GIF or PDF",
  },
  hero_video: {
    maxBytes: MAX_VIDEO_UPLOAD_BYTES,
    mime: VIDEO_MIME,
    accepts: "MP4 or WebM",
  },
};

/** "25" for a round number of MB, "12.5" otherwise — for error copy. */
export function megabytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

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
