import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";
import { MAX_UPLOAD_BYTES, MEDIA_BUCKET, safeFilename, storageKey } from "@/lib/media";
import { SalesforceError, salesforceDownload } from "@/lib/salesforce/client";
import type { ImageRef } from "./snapshot";

/**
 * Copying a listing's photos out of Salesforce into the media library.
 *
 * Copied, not hot-linked. The photos CRM users upload are Salesforce Files,
 * and their links need a Salesforce session — a visitor's browser gets a
 * login page. Even the plain URLs are someone else's to move or delete. A
 * copy in our bucket is served by our CDN, resized by `next/image` under the
 * remote pattern the site already allows, and survives the CRM changing its
 * mind about where files live.
 */

type Admin = SupabaseClient<Database>;

/** The bucket's own ceiling (migration 0070). */
export const MAX_IMAGE_BYTES = MAX_UPLOAD_BYTES;

export type Sniffed = { mime: string; ext: string };

/**
 * What the bytes are, from the bytes. A declared Content-Type is whatever the
 * server felt like saying — Salesforce answers `application/octetstream` for a
 * JPEG — so the file's own signature decides, and anything outside the formats
 * the media library accepts is refused.
 */
export function sniffImage(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { mime: "image/gif", ext: "gif" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(8, 12))) return { mime: "image/avif", ext: "avif" };
  return null;
}

/** True for a hostname that must never be fetched from the server: loopback,
 *  link-local (the cloud metadata address lives there), private ranges. The
 *  URL is CRM data, typed by a person, so it is untrusted input. */
export function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (h.includes(":")) {
    // Any IPv6 literal. Listing photos have no business on a bare address.
    return true;
  }
  return false;
}

export type DownloadResult =
  | { ok: true; bytes: Uint8Array; sniffed: Sniffed }
  /** permanent: the same request will fail the same way — do not retry for a
   *  day. Otherwise it was the network or the org, and the next run tries
   *  again. */
  | { ok: false; permanent: boolean; reason: string };

async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > max) return null;
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/**
 * A photo from the open web. https only, no private addresses, redirects
 * followed by hand so each hop is checked, a hard size cap and a timeout.
 */
export async function fetchWebImage(
  raw: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DownloadResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, permanent: true, reason: "not a valid URL" };
  }
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "https:") return { ok: false, permanent: true, reason: "not an https URL" };
    if (url.username || url.password) return { ok: false, permanent: true, reason: "URL carries credentials" };
    if (isForbiddenHost(url.hostname)) return { ok: false, permanent: true, reason: "private or local address" };

    let res: Response;
    try {
      res = await fetchImpl(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9" },
        cache: "no-store",
      });
    } catch (err) {
      return { ok: false, permanent: false, reason: err instanceof Error ? err.message : String(err) };
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, permanent: true, reason: `HTTP ${res.status} with no Location` };
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok) {
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
      return { ok: false, permanent, reason: `HTTP ${res.status}` };
    }
    const bytes = await readCapped(res, MAX_IMAGE_BYTES);
    if (!bytes) return { ok: false, permanent: true, reason: "larger than 25 MB" };
    const sniffed = sniffImage(bytes);
    if (!sniffed) return { ok: false, permanent: true, reason: "not a JPEG, PNG, WebP, AVIF or GIF" };
    return { ok: true, bytes, sniffed };
  }
  return { ok: false, permanent: true, reason: "too many redirects" };
}

async function fetchSalesforceFile(path: string): Promise<DownloadResult> {
  try {
    const { bytes } = await salesforceDownload(path, MAX_IMAGE_BYTES);
    const sniffed = sniffImage(bytes);
    if (!sniffed) return { ok: false, permanent: true, reason: "not a JPEG, PNG, WebP, AVIF or GIF" };
    return { ok: true, bytes, sniffed };
  } catch (err) {
    if (err instanceof SalesforceError) {
      // 404 / 403: the file is gone or not shared with the integration user.
      // Retrying every run will not change either.
      const permanent = !err.retryable;
      return { ok: false, permanent, reason: err.errorCode ? `${err.errorCode}: ${err.message}` : err.message };
    }
    return { ok: false, permanent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export function downloadImage(ref: ImageRef, propertyId: string | null): Promise<DownloadResult> {
  switch (ref.kind) {
    case "cv":
      return fetchSalesforceFile(`sobjects/ContentVersion/${ref.id}/VersionData`);
    case "rta":
      if (!propertyId) {
        return Promise.resolve({ ok: false, permanent: true, reason: "rich-text image with no Property id" });
      }
      return fetchSalesforceFile(
        `sobjects/Listing__c/${propertyId}/richTextImageFields/${ref.field}/${ref.refId}`,
      );
    case "url":
      return fetchWebImage(ref.url);
  }
}

/**
 * Put one downloaded photo in the media library: the object in Storage, then
 * its `media_assets` row, then the `salesforce_media` row that stops it ever
 * being downloaded again. A failure part-way rolls back what was written, so
 * nothing is left in the bucket that no row points at.
 */
export async function storeImage(
  admin: Admin,
  input: {
    sourceKey: string;
    sourceUrl: string | null;
    bytes: Uint8Array;
    sniffed: Sniffed;
    baseName: string;
    alt: string | null;
  },
): Promise<{ ok: true; mediaId: string } | { ok: false; reason: string }> {
  const filename = safeFilename(`${input.baseName}.${input.sniffed.ext}`);
  const key = storageKey({ folder: "listings", filename, uuid: randomUUID() });

  const up = await admin.storage.from(MEDIA_BUCKET).upload(key, input.bytes, {
    contentType: input.sniffed.mime,
    upsert: false,
  });
  if (up.error) return { ok: false, reason: `storage: ${up.error.message}` };

  const asset = await admin
    .from("media_assets")
    .insert({
      filename,
      mime_type: input.sniffed.mime,
      size_bytes: input.bytes.byteLength,
      storage_key: key,
      folder: "listings",
      alt_text: input.alt,
    })
    .select("id")
    .maybeSingle();
  if (asset.error || !asset.data) {
    await admin.storage.from(MEDIA_BUCKET).remove([key]);
    return { ok: false, reason: `media_assets: ${asset.error?.message ?? "no row"}` };
  }

  const link = await admin.from("salesforce_media").insert({
    source_key: input.sourceKey,
    source_url: input.sourceUrl,
    media_id: asset.data.id,
  });
  if (link.error) {
    // Another run copied the same photo first (the lease should prevent it,
    // but a unique key is the guarantee). Keep theirs, drop ours.
    await admin.from("media_assets").delete().eq("id", asset.data.id);
    await admin.storage.from(MEDIA_BUCKET).remove([key]);
    const existing = await admin
      .from("salesforce_media")
      .select("media_id")
      .eq("source_key", input.sourceKey)
      .maybeSingle();
    if (existing.data) return { ok: true, mediaId: existing.data.media_id };
    return { ok: false, reason: `salesforce_media: ${link.error.message}` };
  }
  return { ok: true, mediaId: asset.data.id };
}
