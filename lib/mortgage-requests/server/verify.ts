/**
 * Completion checks on an uploaded file's actual bytes (PLAN Phase 2, SPEC §2.2,
 * §4.2): the real type from its first bytes rather than its name or declared
 * type, whether a PDF needs a password to open, its page count, and its SHA-256.
 *
 * Password-protected means a PDF that won't open without a password — UAE
 * e-statements usually are, and banks can't read them. A PDF encrypted with
 * only an owner password (print or copy restrictions) opens for anyone and is
 * accepted; telling the two apart needs a real PDF parser, so this uses pdf.js,
 * which the CMS viewer needs anyway (Phase 5).
 */

import { createHash } from "node:crypto";
import { DOCUMENT_RULES, type DocKind, type DocumentMime } from "../documents";

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (bytes: Uint8Array, magic: number[], at = 0) =>
  bytes.length >= at + magic.length && magic.every((b, i) => bytes[at + i] === b);

/** The file's type from its first bytes, or null when it's none the module accepts. */
export function sniffMime(bytes: Uint8Array): DocumentMime | null {
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, PNG)) return "image/png";
  // PDF readers accept the header anywhere in the first 1024 bytes.
  const head = Math.min(bytes.length, 1024);
  for (let i = 0; i + PDF.length <= head; i++) {
    if (startsWith(bytes, PDF, i)) return "application/pdf";
  }
  return null;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsModule: Promise<PdfJs> | null = null;

/**
 * pdf.js on the server. The worker module is imported first so pdf.js runs it
 * in-thread (its "fake worker") instead of resolving a worker file at runtime,
 * which a bundled server can't. next.config.ts keeps the package external.
 */
function pdfjs(): Promise<PdfJs> {
  pdfjsModule ??= (async () => {
    await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return pdfjsModule;
}

export type PdfInspection =
  | { ok: true; pageCount: number }
  | { ok: false; reason: "encrypted_pdf" | "unreadable" };

export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  const { getDocument } = await pdfjs();
  const task = getDocument({
    // pdf.js may detach the buffer it's given; keep the caller's intact.
    data: bytes.slice(),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    const pageCount = doc.numPages;
    await doc.destroy();
    return pageCount > 0 ? { ok: true, pageCount } : { ok: false, reason: "unreadable" };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    if ((error as { name?: string })?.name === "PasswordException") {
      return { ok: false, reason: "encrypted_pdf" };
    }
    return { ok: false, reason: "unreadable" };
  }
}

export type VerifiedUpload =
  | { ok: true; mime: DocumentMime; pageCount: number | null; sha256: string; sizeBytes: number }
  | { ok: false; code: "bad_type" | "encrypted_pdf" | "unreadable" };

/** Everything about a stored file that depends only on its bytes and its kind. */
export async function verifyUpload(kind: DocKind, bytes: Uint8Array): Promise<VerifiedUpload> {
  const mime = sniffMime(bytes);
  if (!mime || !DOCUMENT_RULES[kind].mimes.includes(mime)) return { ok: false, code: "bad_type" };
  let pageCount: number | null = null;
  if (mime === "application/pdf") {
    const pdf = await inspectPdf(bytes);
    if (!pdf.ok) return { ok: false, code: pdf.reason };
    pageCount = pdf.pageCount;
  }
  return { ok: true, mime, pageCount, sha256: sha256Hex(bytes), sizeBytes: bytes.length };
}
