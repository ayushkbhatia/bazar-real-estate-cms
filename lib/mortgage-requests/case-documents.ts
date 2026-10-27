/**
 * Case documents (0171): files the mortgage team uploads to a request, each
 * with a title and a short description. Shared limits, read by the CMS form
 * and the server action alike.
 */
import { DOCUMENT_MIMES, MB, type DocumentMime } from "./documents";

/** Live case documents a request can hold (the SQL function enforces it too). */
export const CASE_DOCUMENTS_MAX = 10;
/** One file's ceiling: well inside the bucket's 40 MiB (0140). */
export const CASE_DOCUMENT_MAX_BYTES = 25 * MB;
export const CASE_DOCUMENT_TITLE_MAX = 120;
export const CASE_DOCUMENT_DESCRIPTION_MAX = 500;
export const NOTE_MAX = 4000;

export function isCaseDocumentMime(mime: string): mime is DocumentMime {
  return (DOCUMENT_MIMES as readonly string[]).includes(mime);
}
