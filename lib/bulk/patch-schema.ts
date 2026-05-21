import { z } from "zod";
import {
  PROPERTY_MODES,
  PROPERTY_STATUSES,
} from "@/lib/schemas/property";
import { BULK_SELECTION_CAP } from "./selection";

const idShape = z
  .string()
  .min(8, "Id is too short")
  .max(64, "Id is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "Id contains illegal characters");

const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );

/**
 * Patch shape for a single bulk-update request. Every field is optional —
 * the refinement at the bottom rejects an empty patch so a caller can't
 * accidentally fire a no-op that still writes audit rows.
 */
export const bulkPatchSchema = z
  .object({
    status: z.enum(PROPERTY_STATUSES).optional(),
    assigned_agent_id: z
      .union([uuid, z.null()])
      .optional(),
    mode: z.enum(PROPERTY_MODES).optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined ||
      v.assigned_agent_id !== undefined ||
      v.mode !== undefined,
    { message: "Patch must change at least one field." },
  );

export type BulkPatch = z.infer<typeof bulkPatchSchema>;

/** Full request body — { ids, patch }. */
export const bulkInputSchema = z.object({
  ids: z
    .array(idShape)
    .min(1, "Select at least one row")
    .max(BULK_SELECTION_CAP, `Maximum ${BULK_SELECTION_CAP} rows per bulk action`),
  patch: bulkPatchSchema,
});

export type BulkInput = z.infer<typeof bulkInputSchema>;

/** Reason an id was dropped from a bulk action — useful for the per-row
 *  pass/fail list the UI surfaces back to the user. */
export type SkipReason =
  | "not_visible"      // RLS hid the row from the current user
  | "publish_blocked"  // I4 publish gate failed
  | "no_change"        // patch was a no-op for this row
  | "error";           // db error on this row

export type BulkSkipped = { id: string; reason: SkipReason; detail?: string };

export type BulkUpdateResult =
  | {
      status: "ok";
      succeeded: string[];
      skipped: BulkSkipped[];
    }
  | { status: "error"; message: string };
