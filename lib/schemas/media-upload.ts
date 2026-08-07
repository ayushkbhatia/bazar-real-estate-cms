import { z } from "zod";
import {
  UPLOAD_FOLDERS,
  UPLOAD_POLICIES,
  megabytes,
  type UploadKind,
} from "@/lib/media";

export const VIDEO_MIME_VALUES = ["video/mp4", "video/webm"] as const;

const UPLOAD_KINDS = ["standard", "hero_video"] as const;

const uploadBase = {
  kind: z.enum(UPLOAD_KINDS),
  folder: z.enum(UPLOAD_FOLDERS),
  filename: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(120),
  size_bytes: z.number().int().positive(),
};

/**
 * Size and type are checked against the kind's policy so a bad file is refused
 * before a signed URL exists, and again by the bucket's own `file_size_limit` —
 * which is the ceiling that actually binds, since a determined client can put
 * whatever it likes in this payload. The finalise step re-measures what landed.
 */
function checkPolicy(
  value: { kind: UploadKind; filename: string; mime: string; size_bytes: number },
  ctx: z.RefinementCtx,
): void {
  const policy = UPLOAD_POLICIES[value.kind];
  if (!policy.mime.has(value.mime))
    ctx.addIssue({
      code: "custom",
      path: ["mime"],
      message: `Unsupported file type "${value.mime}". Use ${policy.accepts}.`,
    });
  if (value.size_bytes > policy.maxBytes)
    ctx.addIssue({
      code: "custom",
      path: ["size_bytes"],
      message: `"${value.filename}" is ${megabytes(value.size_bytes)} MB — keep it under ${megabytes(policy.maxBytes)} MB.`,
    });
}

/**
 * What the browser asks for before it uploads: permission to write one object
 * of a stated size and type into one folder.
 */
export const uploadTicketSchema = z
  .object(uploadBase)
  .superRefine(checkPolicy);
export type UploadTicketInput = z.infer<typeof uploadTicketSchema>;

/**
 * Recorded after the bytes land. `storage_key` is echoed back from the ticket
 * rather than trusted blindly — the action re-derives its shape and refuses
 * anything that doesn't match a key it minted.
 */
export const finaliseUploadSchema = z
  .object({
    ...uploadBase,
    storage_key: z.string().trim().min(1).max(400),
    alt_text: z.string().trim().max(300).nullable().optional(),
  })
  .superRefine(checkPolicy);
export type FinaliseUploadInput = z.infer<typeof finaliseUploadSchema>;
