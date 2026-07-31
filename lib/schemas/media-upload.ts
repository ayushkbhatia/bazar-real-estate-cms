import { z } from "zod";
import { MAX_VIDEO_UPLOAD_BYTES, megabytes } from "@/lib/media";

export const VIDEO_MIME_VALUES = ["video/mp4", "video/webm"] as const;

/**
 * What the browser asks for before it uploads: permission to write one object
 * of a stated size and type. The size is checked here so an oversized file is
 * refused before a signed URL exists, and again by the bucket's own
 * `file_size_limit` — which is the ceiling that actually binds, since a
 * determined client can put whatever it likes in this payload.
 */
export const videoUploadTicketSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  mime: z.enum(VIDEO_MIME_VALUES),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(
      MAX_VIDEO_UPLOAD_BYTES,
      `Video is too large — keep it under ${megabytes(MAX_VIDEO_UPLOAD_BYTES)} MB.`,
    ),
});
export type VideoUploadTicketInput = z.infer<typeof videoUploadTicketSchema>;

/**
 * Recorded after the bytes land. `storage_key` is echoed back from the ticket
 * rather than trusted blindly — the action re-derives it and refuses anything
 * that doesn't match a key it minted.
 */
export const finaliseVideoUploadSchema = z.object({
  storage_key: z.string().trim().min(1).max(400),
  filename: z.string().trim().min(1).max(200),
  mime: z.enum(VIDEO_MIME_VALUES),
  size_bytes: z.number().int().positive().max(MAX_VIDEO_UPLOAD_BYTES),
});
export type FinaliseVideoUploadInput = z.infer<typeof finaliseVideoUploadSchema>;
