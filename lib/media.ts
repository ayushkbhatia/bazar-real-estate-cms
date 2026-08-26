import { env } from "@/lib/env";

export const MEDIA_BUCKET = "media";

/**
 * Every upload — image, PDF, hero video — goes browser → Supabase Storage on a
 * short-lived signed URL, so this ceiling is real rather than aspirational.
 *
 * It did not used to be. Uploads posted their bytes to the `uploadMedia`
 * server action, which made them a Vercel Function request body, and Vercel
 * caps that at 4.5 MB — over it the platform returns `413
 * FUNCTION_PAYLOAD_TOO_LARGE` before the function runs, on every plan, with no
 * way to raise it. So a "10 MB" limit meant 4.5 MB in production and 10 MB on
 * a dev machine, where no such cap exists: uploads that worked locally failed
 * for the admin team, with an error the app never got to phrase.
 *
 * Direct-to-Storage removes that layer, and the ceiling that binds is the
 * `media` bucket's own `file_size_limit` — 25 MB, set in migration 0070.
 * Keep this constant and that limit in step; the bucket is what actually
 * refuses oversized bytes, this is what tells the operator why.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "application/pdf",
]);

/**
 * Hero video shares the ceiling now that every control shares the transport.
 * Kept as its own constant because the two are separate policy decisions that
 * happen to agree — a smaller video cap would not imply a smaller image cap.
 */
export const MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const VIDEO_MIME = new Set<string>(["video/mp4", "video/webm"]);

/**
 * A webfont is small — a subsetted Arabic woff2 is 40-150 KB, and the two
 * Bukra faces vendored under contact-qr/_fonts are 26 KB and 48 KB. The cap is
 * generous rather than tight because an unsubsetted .otf straight off a
 * foundry download routinely clears 1 MB, and refusing the file the client
 * actually bought is a worse failure than serving a fat one.
 */
export const MAX_FONT_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Browsers disagree about what a font file is.
 *
 * `font/woff2` is the registered type and is what Chrome reports, but Safari
 * has shipped `application/font-woff2`, Windows reports `.otf` as
 * `application/x-font-otf` or nothing at all, and a `.ttf` dragged out of a zip
 * frequently arrives as `application/octet-stream`. So MIME cannot be the gate
 * here the way it is for images — `EXT_FONT_FORMAT` below is, and this set
 * exists only to keep the obviously-wrong file (a PNG renamed to .woff2) from
 * reaching Storage.
 */
export const FONT_MIME = new Set<string>([
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
  "font/sfnt",
  "application/font-woff",
  "application/font-woff2",
  "application/font-sfnt",
  "application/x-font-woff",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/x-font-truetype",
  "application/x-font-opentype",
  "application/vnd.ms-opentype",
  // What a drag out of a zip, an SMB share or Windows Explorer reports. The
  // extension check is what actually refuses a non-font here.
  "application/octet-stream",
  "",
]);

export type UploadKind = "standard" | "hero_video" | "font";

/** Every folder the media library will mint a key under. */
export const UPLOAD_FOLDERS = [
  "listings",
  "brand",
  "blog",
  "team",
  "documents",
  // Arabic webfaces uploaded at /admin/settings/typography (0119 adds the enum
  // value). Their own folder so the brand pickers, which read `brand/`, never
  // offer a .woff2 as artwork.
  "fonts",
] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/**
 * Extension -> the `format()` hint an `@font-face` `src` must carry.
 *
 * Doubles as the font allowlist: `checkPolicy` refuses a filename whose
 * extension is not a key here, which is the check that actually holds, since
 * `FONT_MIME` has to admit `application/octet-stream` to be usable at all.
 *
 * .eot and .svg are deliberately absent — both are dead formats whose only
 * consumers (IE and iOS 4) predate every browser that can render this site,
 * and `format("embedded-opentype")` in a modern src list is a wasted request.
 */
export const EXT_FONT_FORMAT = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
} as const;
export type FontFormat = (typeof EXT_FONT_FORMAT)[keyof typeof EXT_FONT_FORMAT];

/** The lowercased extension of a filename, or "" when it has none. */
export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return "";
  return filename
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** The `format()` hint for a font filename, or null when it is not a font. */
export function fontFormatFor(filename: string): FontFormat | null {
  const ext = fileExtension(filename);
  return (EXT_FONT_FORMAT as Record<string, FontFormat>)[ext] ?? null;
}

/**
 * The Content-Type to store a font under, derived from its extension.
 *
 * Storage serves an object back with whatever type it was written with, and
 * the browser reports `application/octet-stream` for half of all font uploads
 * (see FONT_MIME). Browsers do not consult Content-Type when matching an
 * `@font-face` — the `format()` hint and the file's own magic bytes decide —
 * so this is not load-bearing for rendering. It is load-bearing for anyone who
 * later fetches the URL directly, and for the media library's own listing.
 */
export function fontContentType(filename: string): string | null {
  const ext = fileExtension(filename);
  if (!(ext in EXT_FONT_FORMAT)) return null;
  return `font/${ext}`;
}

export type UploadPolicy = {
  maxBytes: number;
  mime: ReadonlySet<string>;
  /** Accepted-formats phrase, used verbatim in client + server error copy. */
  accepts: string;
  /**
   * Lowercased extensions the kind admits. Present only where MIME is not a
   * usable gate (fonts); `undefined` means "the MIME set decides", which is
   * what every image and video control wants.
   */
  extensions?: ReadonlySet<string>;
  /** `accept` attribute for the file input, when the kind wants a narrow one. */
  acceptAttr?: string;
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
  font: {
    maxBytes: MAX_FONT_UPLOAD_BYTES,
    mime: FONT_MIME,
    accepts: "WOFF2, WOFF, TTF or OTF",
    extensions: new Set(Object.keys(EXT_FONT_FORMAT)),
    acceptAttr: ".woff2,.woff,.ttf,.otf",
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
  folder: UploadFolder;
  filename: string;
  uuid: string;
}): string {
  return `${opts.folder}/${opts.uuid}-${safeFilename(opts.filename)}`;
}

/**
 * Does this key look like one `createUploadTicket` minted — `<folder>/<uuid>-`?
 *
 * The finalise action re-checks the key the browser echoes back, so a caller
 * can't point a `media_assets` row at an arbitrary object elsewhere in the
 * bucket. Lives here so the pattern is stated once, next to `storageKey`.
 */
export function isMintedKey(key: string, folder: UploadFolder): boolean {
  return new RegExp(
    `^${folder}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-`,
  ).test(key);
}
