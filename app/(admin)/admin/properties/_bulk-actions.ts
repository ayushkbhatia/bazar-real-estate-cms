"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { applyBulkUpdate, type BulkUpdateClient } from "@/lib/bulk/update";
import {
  type BulkInput,
  type BulkUpdateResult,
} from "@/lib/bulk/patch-schema";
import { BULK_SELECTION_CAP } from "@/lib/bulk/selection";
import {
  evaluateBulkPublishability,
  listPropertiesByIdsForBulk,
  type BulkPropertyRow,
} from "@/lib/queries/properties-bulk";
import { propertyUrl } from "@/lib/queries/property-utils";

/**
 * Server-action wrapper around `applyBulkUpdate`. The pure update helper
 * lives in `lib/bulk/update.ts` so the RLS-skip logic is unit-testable
 * with a mock client.
 *
 * Revalidates the admin properties index after every successful change so
 * the table reflects the new state on the next render. Public-side paths
 * are only invalidated when the patch touches `status` — most bulk patches
 * (e.g. agent reassignment) don't change the public surface.
 */
export async function bulkUpdateProperties(
  input: BulkInput,
): Promise<BulkUpdateResult> {
  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };
  }

  const supabase = await createSupabaseServerClient();
  // The Supabase generated client type is structurally compatible with
  // BulkUpdateClient, but the deeply-typed PostgrestFilterBuilder triggers
  // ts2589 here. Cast through unknown — the runtime contract is honoured.
  const client = supabase as unknown as BulkUpdateClient;
  const result = await applyBulkUpdate(client, input, logAudit);

  if (result.status === "ok" && result.succeeded.length > 0) {
    revalidatePath("/admin/properties");
    if (input.patch.status !== undefined) {
      revalidatePath("/buy");
      revalidatePath("/rent");
      revalidatePath("/");
    }
  }

  return result;
}

export type BulkPublishOutcome = {
  /** Ids that passed the publish gate and are now published. */
  succeeded: string[];
  /** Ids the gate blocked — the row stays in selection so the user can fix
   *  and retry. Includes the blockers so the UI can show what to fix. */
  blocked: { id: string; reference: string; blockers: string[] }[];
  /** Ids the user can't see / can't write. */
  skipped: { id: string; reason: string }[];
};

export type BulkPublishResult =
  | { status: "ok"; outcome: BulkPublishOutcome }
  | { status: "error"; message: string };

/**
 * Bulk-publish a list of property ids. Each id goes through the same
 * publishability gate as the single-property publish flow (compliance +
 * permit + hero + slug + title + price). Blocked rows are returned with
 * their per-row reasons so the UI can surface a pass/fail list and keep
 * the user's selection of failed rows intact.
 *
 * Audit + revalidation are reused from `bulkUpdateProperties`.
 */
export async function bulkPublishProperties(
  ids: string[],
): Promise<BulkPublishResult> {
  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };
  }
  if (ids.length === 0) {
    return {
      status: "error",
      message: "Select at least one property to publish.",
    };
  }
  if (ids.length > BULK_SELECTION_CAP) {
    return {
      status: "error",
      message: `Maximum ${BULK_SELECTION_CAP} properties per bulk action.`,
    };
  }

  const visibleRows = await listPropertiesByIdsForBulk(ids);
  const visibleMap = new Map(visibleRows.map((r) => [r.id, r]));

  const notVisible: BulkPublishOutcome["skipped"] = ids
    .filter((id) => !visibleMap.has(id))
    .map((id) => ({ id, reason: "not_visible" }));

  const passRows: BulkPropertyRow[] = [];
  const blocked: BulkPublishOutcome["blocked"] = [];

  for (const row of visibleRows) {
    const check = evaluateBulkPublishability(row);
    if (check.ok) passRows.push(row);
    else
      blocked.push({
        id: row.id,
        reference: row.reference,
        blockers: check.blockers,
      });
  }

  if (passRows.length === 0) {
    return {
      status: "ok",
      outcome: { succeeded: [], blocked, skipped: notVisible },
    };
  }

  const result = await bulkUpdateProperties({
    ids: passRows.map((r) => r.id),
    patch: { status: "published" },
  });
  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  const succeededSet = new Set(result.succeeded);
  // Anything we attempted to publish that didn't land surfaces as a write
  // failure — fold it into `blocked` with a generic reason so the UI keeps
  // it in selection.
  for (const row of passRows) {
    if (!succeededSet.has(row.id)) {
      blocked.push({
        id: row.id,
        reference: row.reference,
        blockers: ["Update failed (RLS or transient db error)"],
      });
    }
  }

  // Cleanly revalidate each newly-published detail URL.
  for (const row of passRows) {
    if (succeededSet.has(row.id)) {
      revalidatePath(propertyUrl(row));
    }
  }

  return {
    status: "ok",
    outcome: {
      succeeded: result.succeeded,
      blocked,
      skipped: [
        ...notVisible,
        ...result.skipped.map((s) => ({ id: s.id, reason: s.reason })),
      ],
    },
  };
}
