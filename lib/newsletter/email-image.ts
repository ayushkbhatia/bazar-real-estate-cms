/**
 * A newsletter image's address: the media-library original, made fit for an
 * inbox by `/api/newsletter/image`.
 *
 * WHY. The bucket holds originals. The JW Marriott launch's hero was a 7.7 MB
 * PNG, sent as-is to every recipient — the slow load the client saw (Nov
 * 2026). The route resizes to about twice the width the image shows at,
 * re-encodes as JPEG (every client draws it; Outlook desktop draws no WebP)
 * and is cached for a year at the edge, so it is made once, not per open.
 *
 * It also does the two things an inbox cannot be trusted to do in CSS:
 *  - CROP to an aspect ratio (`ratio`, width ÷ height), so a strip is the
 *    shape the design asks for whatever was uploaded;
 *  - TINT with the hero's overlay colour (`tint` + `opacity`). Gmail drops a
 *    `linear-gradient` background and Outlook desktop draws no CSS background
 *    at all, so an overlay painted in CSS never reached most inboxes. Baked
 *    into the pixels, it is in every one.
 *
 * Only media-library keys go through it — the route builds the source URL
 * from the key, never from a URL it is handed, so it cannot be pointed at
 * another host. An image with no key keeps its stored URL.
 *
 * Pure module: the renderer and the route share the parameter rules.
 */

export type EmailImageOptions = {
  /** Display width in CSS px; the file is made at twice that, capped. */
  width: number;
  /** Width ÷ height to crop to; absent keeps the original's shape. */
  ratio?: number | null;
  /** Overlay colour, `#RRGGBB`. */
  tint?: string | null;
  /** Overlay strength, 0–100. */
  opacity?: number | null;
};

export const EMAIL_IMAGE_PATH = "/api/newsletter/image";

/** The widths the route makes — a short list, so the edge cache stays small. */
const WIDTHS = [240, 480, 720, 960, 1200] as const;
const MAX_RATIO = 5;
const MIN_RATIO = 0.4;

/** A storage key the route will accept: the media bucket's own path shape. */
export function isMediaKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9_\-/.]{0,300}$/i.test(key) && !key.includes("..");
}

function pickWidth(displayWidth: number): number {
  const want = Math.max(1, Math.round(displayWidth * 2));
  return WIDTHS.find((w) => w >= want) ?? WIDTHS[WIDTHS.length - 1]!;
}

function cleanRatio(r: unknown): number | null {
  const n = typeof r === "number" ? r : typeof r === "string" ? Number(r) : NaN;
  if (!Number.isFinite(n) || n < MIN_RATIO || n > MAX_RATIO) return null;
  return Math.round(n * 100) / 100;
}

function cleanTint(t: unknown): string | null {
  return typeof t === "string" && /^#?[0-9a-f]{6}$/i.test(t) ? t.replace("#", "").toUpperCase() : null;
}

function cleanOpacity(o: unknown): number | null {
  const n = typeof o === "number" ? o : typeof o === "string" ? Number(o) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(90, Math.round(n));
}

/** The address an email uses for a media-library image. */
export function emailImageUrl(siteUrl: string, key: string, o: EmailImageOptions): string {
  const q = new URLSearchParams({ k: key, w: String(pickWidth(o.width)) });
  const ratio = cleanRatio(o.ratio);
  if (ratio) q.set("r", String(ratio));
  const tint = cleanTint(o.tint);
  const opacity = cleanOpacity(o.opacity);
  if (tint && opacity) {
    q.set("t", tint);
    q.set("o", String(opacity));
  }
  return `${siteUrl}${EMAIL_IMAGE_PATH}?${q.toString()}`;
}

export type EmailImageParams = {
  key: string;
  width: number;
  ratio: number | null;
  tint: string | null;
  opacity: number | null;
};

/** The route's reading of its query string, or null when it isn't one we make. */
export function parseEmailImageParams(q: URLSearchParams): EmailImageParams | null {
  const key = q.get("k") ?? "";
  const width = Number(q.get("w"));
  if (!isMediaKey(key) || !(WIDTHS as readonly number[]).includes(width)) return null;
  const tint = cleanTint(q.get("t"));
  const opacity = cleanOpacity(q.get("o"));
  return {
    key,
    width,
    ratio: cleanRatio(q.get("r")),
    tint: tint && opacity ? tint : null,
    opacity: tint && opacity ? opacity : null,
  };
}
