/**
 * The browser's side of the mortgage API (docs/mortgage/frontend/00-foundations
 * §8; SPEC §4.2). JSON both ways; every failure is an `ApiError` carrying the
 * server's `{ code, field, … }`, or `code: "network"` when nothing came back.
 *
 * Tokens travel in headers, never in a URL: the draft token as
 * `Authorization: Bearer`, the submit's retry key as `Idempotency-Key`.
 */

import type { DocKind } from "../documents";
import type { Details, EntryPoint, Service } from "../details";

export type DraftHandle = { draftId: string; draftToken: string; expiresAt: string };

export type FileStatus =
  | { status: "uploading" }
  | { status: "ready"; sizeBytes: number; pageCount: number | null }
  | { status: "removed" };

export type Presigned = { fileId: string; uploadUrl: string; headers: Record<string, string> };

export type SubmitBody =
  | {
      service: "consultancy";
      details: Details;
      entryPoint: EntryPoint;
      propertyRef?: string;
      siteLocale?: "en" | "ar";
    }
  | {
      service: "pre_approval";
      details: Details;
      draftId: string;
      /** The files shown as ready: only these are attached. */
      fileIds: string[];
      consent: { given: true; wordingVersion: string };
      entryPoint: EntryPoint;
      propertyRef?: string;
      siteLocale?: "en" | "ar";
    };

export type SubmitResponse = {
  reference: string;
  service: Service;
  submittedAt: string;
  dueAt: string | null;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly field?: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "network");
  }
  if (res.status === 204) return undefined as T;
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // A proxy's HTML error page, or an empty body.
  }
  if (!res.ok) {
    const { code, field, ...details } = body;
    throw new ApiError(
      res.status,
      typeof code === "string" ? code : res.status === 429 ? "rate_limited" : "internal",
      typeof field === "string" ? field : undefined,
      details,
    );
  }
  return body as T;
}

const files = (draftId: string) => `/api/mortgage/drafts/${encodeURIComponent(draftId)}/files`;

export function createDraft(): Promise<DraftHandle> {
  return call("/api/mortgage/drafts", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function presignFile(
  draft: DraftHandle,
  file: { kind: DocKind; name: string; size: number; mime: string; replaces?: string[] },
): Promise<Presigned> {
  return call(files(draft.draftId), {
    method: "POST",
    token: draft.draftToken,
    body: JSON.stringify(file),
  });
}

export function completeFile(draft: DraftHandle, fileId: string): Promise<FileStatus> {
  return call(`${files(draft.draftId)}/${encodeURIComponent(fileId)}/complete`, {
    method: "POST",
    token: draft.draftToken,
    body: "{}",
  });
}

export function fileStatus(draft: DraftHandle, fileId: string): Promise<FileStatus> {
  return call(`${files(draft.draftId)}/${encodeURIComponent(fileId)}`, {
    method: "GET",
    token: draft.draftToken,
  });
}

export function deleteFile(draft: DraftHandle, fileId: string): Promise<void> {
  return call(`${files(draft.draftId)}/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    token: draft.draftToken,
  });
}

export function submitRequest(
  body: SubmitBody,
  idempotencyKey: string,
  draftToken?: string,
): Promise<SubmitResponse> {
  return call("/api/mortgage/requests", {
    method: "POST",
    token: draftToken,
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
}

/**
 * PUT the bytes straight to storage (they never pass through our functions:
 * Vercel caps a body at 4.5 MB). XHR rather than fetch, for upload progress.
 */
export function putFile(
  presigned: Presigned,
  file: Blob,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presigned.uploadUrl);
    for (const [name, value] of Object.entries(presigned.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, xhr.status === 413 ? "too_large" : "upload_failed"));
    xhr.onerror = () => reject(new ApiError(0, "network"));
    xhr.onabort = () => reject(new ApiError(0, "cancelled"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
