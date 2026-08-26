"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  MEDIA_BUCKET,
  UPLOAD_POLICIES,
  fileExtension,
  fontContentType,
  megabytes,
  type UploadFolder,
  type UploadKind,
} from "@/lib/media";
import { createUploadTicket, finaliseUpload } from "./_upload-actions";

export type LibraryUploadResult =
  | {
      status: "ok";
      id: string;
      storage_key: string;
      filename: string;
      url: string;
      mime: string;
    }
  | { status: "error"; message: string };

/**
 * Put one file in the media library.
 *
 * Three steps: ask the server for a signed upload URL, PUT the bytes straight
 * to Supabase Storage, then have the server record the `media_assets` row.
 * The bytes skip the Next server entirely — see _upload-actions.ts for why
 * that is mandatory rather than merely faster.
 *
 * Every caller that adds a file goes through here, so size and type policy is
 * stated once (lib/media.ts `UPLOAD_POLICIES`) and the operator gets the same
 * wording wherever they upload.
 */
export async function uploadToLibrary(
  file: File,
  opts: {
    folder: UploadFolder;
    kind?: UploadKind;
    alt_text?: string | null;
  },
): Promise<LibraryUploadResult> {
  const kind = opts.kind ?? "standard";
  const policy = UPLOAD_POLICIES[kind];

  // Checked again on the server and capped by the bucket itself. This pass is
  // only so the operator finds out before sitting through the upload.
  if (file.size === 0)
    return { status: "error", message: `"${file.name}" is empty.` };
  if (!policy.mime.has(file.type))
    return {
      status: "error",
      message: `Unsupported file type "${file.type || "unknown"}". Use ${policy.accepts}.`,
    };
  if (policy.extensions && !policy.extensions.has(fileExtension(file.name)))
    return {
      status: "error",
      message: `"${file.name}" isn't a font file. Use ${policy.accepts}.`,
    };
  if (file.size > policy.maxBytes)
    return {
      status: "error",
      message: `"${file.name}" is ${megabytes(file.size)} MB — keep it under ${megabytes(policy.maxBytes)} MB.`,
    };

  /*
   * What the object is stored AS, which is not always what the browser said it
   * is. Half of all font uploads arrive as `application/octet-stream` or with
   * an empty `type` (lib/media.ts FONT_MIME), and Storage serves an object
   * back under whatever type it was written with — so a face fetched directly,
   * or listed in the media library, would read as a binary blob for ever.
   * Images and video keep `file.type` verbatim: it is already right for them,
   * and their extension is the less trustworthy half of the pair.
   *
   * Resolved before the ticket, not after, because `uploadTicketSchema` wants
   * a non-empty `mime` and a font dragged off an SMB share has none.
   */
  const contentType =
    (kind === "font" ? fontContentType(file.name) : null) ||
    file.type ||
    "application/octet-stream";

  const ticket = await createUploadTicket({
    kind,
    folder: opts.folder,
    filename: file.name,
    mime: contentType,
    size_bytes: file.size,
  });
  if (ticket.status === "error") return ticket;

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .uploadToSignedUrl(ticket.storage_key, ticket.token, file, {
      contentType,
      // A font is immutable — the storage key carries a uuid, so a new file is
      // a new URL and this one never changes again. An hour is what every
      // other asset gets; a year is what a face keyed like this can safely
      // take, and it is the difference between a repaint on every navigation
      // and one download per visitor.
      cacheControl: kind === "font" ? "31536000" : "3600",
    });
  if (error)
    return { status: "error", message: `Upload failed: ${error.message}` };

  return finaliseUpload({
    kind,
    folder: opts.folder,
    storage_key: ticket.storage_key,
    filename: file.name,
    mime: contentType,
    size_bytes: file.size,
    alt_text: opts.alt_text ?? null,
  });
}
