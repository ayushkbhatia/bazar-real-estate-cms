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

export type BulkOffMarketResult =
  | {
      status: "ok";
      succeeded: string[];
      skipped: { id: string; reason: string }[];
    }
  | { status: "error"; message: string };

/**
 * Bulk move-off-market. Wraps `bulkUpdateProperties` with
 * `status='off_market'` then revalidates each succeeded property's
 * public detail URL (the index pages /buy, /rent, / are already
 * revalidated upstream because the patch changes `status`).
 */
export async function bulkMoveOffMarket(
  ids: string[],
): Promise<BulkOffMarketResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Supabase env vars are not set." };
  }
  if (ids.length === 0) {
    return {
      status: "error",
      message: "Select at least one property to move off-market.",
    };
  }
  if (ids.length > BULK_SELECTION_CAP) {
    return {
      status: "error",
      message: `Maximum ${BULK_SELECTION_CAP} properties per bulk action.`,
    };
  }

  // Pre-fetch so we can revalidate the right public URLs after.
  const rows = await listPropertiesByIdsForBulk(ids);
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const result = await bulkUpdateProperties({
    ids,
    patch: { status: "off_market" },
  });
  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  for (const id of result.succeeded) {
    const row = rowById.get(id);
    if (row) revalidatePath(propertyUrl(row));
  }

  return {
    status: "ok",
    succeeded: result.succeeded,
    skipped: result.skipped.map((s) => ({ id: s.id, reason: s.reason })),
  };
}

export type BulkArchiveResult =
  | {
      status: "ok";
      succeeded: string[];
      skipped: { id: string; reason: string }[];
    }
  | { status: "error"; message: string };

/**
 * Bulk archive. Destructive — sets status='archived' AND deleted_at=now()
 * in a single UPDATE so the rows fall out of every future bulk action
 * (`bulkUpdateProperties` filters `.is("deleted_at", null)`).
 *
 * This bypasses `bulkUpdateProperties` because the patch schema doesn't
 * expose `deleted_at` (a server-set timestamp, not a user input) and the
 * audit key needs to be `property.bulk_archive`, not `property.bulk_update`.
 */
export async function bulkArchiveProperties(
  ids: string[],
): Promise<BulkArchiveResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Supabase env vars are not set." };
  }
  if (ids.length === 0) {
    return {
      status: "error",
      message: "Select at least one property to archive.",
    };
  }
  if (ids.length > BULK_SELECTION_CAP) {
    return {
      status: "error",
      message: `Maximum ${BULK_SELECTION_CAP} properties per bulk action.`,
    };
  }

  const supabase = await createSupabaseServerClient();

  // Pre-fetch for audit before/after AND to compute the revalidation URLs.
  const { data: beforeData, error: selectError } = await supabase
    .from("properties")
    .select("id, status, slug, reference")
    .in("id", ids)
    .is("deleted_at", null);
  if (selectError) {
    return { status: "error", message: selectError.message };
  }
  const beforeRows = beforeData ?? [];
  const beforeMap = new Map(beforeRows.map((r) => [r.id, r]));

  const notVisible = ids
    .filter((id) => !beforeMap.has(id))
    .map((id) => ({ id, reason: "not_visible" }));

  if (beforeRows.length === 0) {
    return { status: "ok", succeeded: [], skipped: notVisible };
  }

  const nowIso = new Date().toISOString();
  const visibleIds = beforeRows.map((r) => r.id);
  const { data: afterData, error: updateError } = await supabase
    .from("properties")
    .update({ status: "archived", deleted_at: nowIso })
    .in("id", visibleIds)
    .is("deleted_at", null)
    .select("id, status");
  if (updateError) {
    return { status: "error", message: updateError.message };
  }
  const afterRows = afterData ?? [];
  const afterMap = new Map(afterRows.map((r) => [r.id, r]));

  const writeFailures = visibleIds
    .filter((id) => !afterMap.has(id))
    .map((id) => ({ id, reason: "error" }));

  // Per-id audit row, action='property.bulk_archive'.
  await Promise.all(
    afterRows.map((after) =>
      logAudit({
        action: "property.bulk_archive",
        target_kind: "property",
        target_id: after.id,
        before: { status: beforeMap.get(after.id)?.status ?? null, deleted_at: null },
        after: { status: "archived", deleted_at: nowIso },
      }),
    ),
  );

  // Revalidate the admin index + each archived row's public detail URL
  // (which will now 410). The catalogue index pages drop them automatically
  // since they filter on deleted_at IS NULL.
  if (afterRows.length > 0) {
    revalidatePath("/admin/properties");
    revalidatePath("/buy");
    revalidatePath("/rent");
    revalidatePath("/");
    for (const after of afterRows) {
      const before = beforeMap.get(after.id);
      if (before) revalidatePath(propertyUrl(before));
    }
  }

  return {
    status: "ok",
    succeeded: afterRows.map((r) => r.id),
    skipped: [...notVisible, ...writeFailures],
  };
}

export type BulkReassignResult =
  | {
      status: "ok";
      succeeded: string[];
      skipped: { id: string; reason: string }[];
    }
  | { status: "error"; message: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bulk-reassign a list of properties to an agent (or to "no agent" when
 * `agentId === null`). Validates the agent id at the boundary; the deeper
 * RLS gate happens inside `bulkUpdateProperties`.
 *
 * Per-id audit rows come from `bulkUpdateProperties` automatically — they
 * use action='property.bulk_update' with `{ assigned_agent_id }` deltas.
 */
export async function bulkReassignProperties(
  ids: string[],
  agentId: string | null,
): Promise<BulkReassignResult> {
  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message: "Supabase env vars are not set.",
    };
  }
  if (ids.length === 0) {
    return {
      status: "error",
      message: "Select at least one property to reassign.",
    };
  }
  if (agentId !== null && !UUID_RE.test(agentId)) {
    return { status: "error", message: "Invalid agent id." };
  }

  const result = await bulkUpdateProperties({
    ids,
    patch: { assigned_agent_id: agentId },
  });
  if (result.status === "error") {
    return { status: "error", message: result.message };
  }
  return {
    status: "ok",
    succeeded: result.succeeded,
    skipped: result.skipped.map((s) => ({ id: s.id, reason: s.reason })),
  };
}
