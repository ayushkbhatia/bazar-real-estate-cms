/**
 * The browser's side of the secure-link API (SPEC §4.2 `/api/mortgage/links/…`):
 * the code, and uploads and sending scoped to the link. The session is an
 * httpOnly cookie the verify call sets, so nothing here holds a secret — the
 * token is in the path because the link token IS the URL (SPEC §8).
 */

import type { DocKind } from "../documents";
import { call, putFile, type FileStatus, type Presigned } from "./api";
import type { Transport } from "./upload-queue";

const base = (token: string) => `/api/mortgage/links/${encodeURIComponent(token)}`;

export function sendCode(token: string): Promise<{ channel: "email" | "whatsapp"; destination: string }> {
  return call(`${base(token)}/otp`, { method: "POST", body: "{}" });
}

export function verifyCode(token: string, code: string): Promise<{ ok: true }> {
  return call(`${base(token)}/verify`, { method: "POST", body: JSON.stringify({ code }) });
}

/** The upload engine's transport, pointed at the link's own endpoints. */
export function linkTransport(token: string): Transport {
  const files = `${base(token)}/files`;
  return {
    presign: (file: { kind: DocKind; name: string; size: number; mime: string; replaces?: string[] }) =>
      call<Presigned>(files, { method: "POST", body: JSON.stringify(file) }),
    put: (presigned, blob, onProgress, signal) => putFile(presigned, blob, (loaded) => onProgress(loaded), signal),
    complete: (fileId) => call<FileStatus>(`${files}/${encodeURIComponent(fileId)}/complete`, { method: "POST", body: "{}" }),
    status: (fileId) => call<FileStatus>(`${files}/${encodeURIComponent(fileId)}`, { method: "GET" }),
    remove: (fileId) => call<void>(`${files}/${encodeURIComponent(fileId)}`, { method: "DELETE" }),
  };
}

export function sendReupload(token: string, fileIds: string[]): Promise<{ sent: true }> {
  return call(`${base(token)}/submit`, { method: "POST", body: JSON.stringify({ fileIds }) });
}

export function submitInvite(
  token: string,
  body: { fileIds: string[]; consent: { given: true; wordingVersion: string } },
  idempotencyKey: string,
): Promise<{ reference: string; submittedAt: string; dueAt: string | null }> {
  return call(`${base(token)}/submit`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
}
