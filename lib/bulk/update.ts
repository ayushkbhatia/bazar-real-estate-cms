import {
  bulkInputSchema,
  type BulkInput,
  type BulkSkipped,
  type BulkUpdateResult,
} from "./patch-schema";

type BeforeRow = {
  id: string;
  status: string;
  assigned_agent_id: string | null;
  mode: string;
};

type AfterRow = BeforeRow;

type DbError = { message: string } | null;

type SelectChain = PromiseLike<{
  data: BeforeRow[] | null;
  error: DbError;
}> & {
  in: (column: string, ids: string[]) => SelectChain;
  is: (column: string, value: null) => SelectChain;
};

type UpdateSelectChain = PromiseLike<{
  data: AfterRow[] | null;
  error: DbError;
}>;

type UpdateChain = {
  in: (column: string, ids: string[]) => UpdateChain;
  is: (column: string, value: null) => UpdateChain;
  select: (cols: string) => UpdateSelectChain;
};

/**
 * Minimal subset of the Supabase JS client that `applyBulkUpdate` depends
 * on. The real `SupabaseClient<Database>` is structurally compatible — its
 * filter builder is a PromiseLike with `.in / .is / .select` methods. Tests
 * use a hand-rolled mock that fits the same shape.
 */
export type BulkUpdateClient = {
  from: (table: "properties") => {
    select: (cols: string) => SelectChain;
    update: (patch: Record<string, unknown>) => UpdateChain;
  };
};

type AuditFn = (entry: {
  action: string;
  target_kind: "property";
  target_id: string;
  before: Partial<BeforeRow> | null;
  after: Partial<AfterRow> | null;
}) => Promise<void>;

const PROPERTY_BULK_UPDATE = "property.bulk_update";

/**
 * Apply a patch to many properties at once. The Supabase client is passed
 * in so the same body can run inside a server action (real client) or a
 * unit test (mock client).
 *
 * Semantics:
 *  - The `before` snapshot is captured by SELECT-ing the requested ids
 *    *with RLS applied*. Any id not in that result is "not_visible" — the
 *    user can't see it, so skip it. We do NOT try to update it.
 *  - The UPDATE statement is also RLS-aware. The returned rows are the
 *    successful writes; an id that survived the SELECT but is missing
 *    here is treated as a write-side failure ("error").
 *  - One audit row per successful id, with before/after deltas for the
 *    patched fields only (so audit diffs stay readable).
 */
export async function applyBulkUpdate(
  client: BulkUpdateClient,
  input: BulkInput,
  logAudit: AuditFn,
): Promise<BulkUpdateResult> {
  const parsed = bulkInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Invalid bulk update request.",
    };
  }

  const { ids, patch } = parsed.data;

  // 1. SELECT before-state. RLS will drop hidden rows.
  const before = await client
    .from("properties")
    .select("id, status, assigned_agent_id, mode")
    .in("id", ids)
    .is("deleted_at", null);
  if (before.error) {
    return { status: "error", message: before.error.message };
  }
  const beforeRows: BeforeRow[] = before.data ?? [];
  const beforeMap = new Map(beforeRows.map((r) => [r.id, r]));

  const notVisibleSkipped: BulkSkipped[] = ids
    .filter((id) => !beforeMap.has(id))
    .map((id) => ({ id, reason: "not_visible" }));

  if (beforeRows.length === 0) {
    return { status: "ok", succeeded: [], skipped: notVisibleSkipped };
  }

  // 2. UPDATE. Scope to the visible ids to avoid hitting rows we already know about.
  const visibleIds = beforeRows.map((r) => r.id);
  const updateResult = await client
    .from("properties")
    .update(patch as Record<string, unknown>)
    .in("id", visibleIds)
    .is("deleted_at", null)
    .select("id, status, assigned_agent_id, mode");
  if (updateResult.error) {
    return { status: "error", message: updateResult.error.message };
  }
  const afterRows: AfterRow[] = updateResult.data ?? [];
  const afterMap = new Map(afterRows.map((r) => [r.id, r]));

  const writeFailures: BulkSkipped[] = visibleIds
    .filter((id) => !afterMap.has(id))
    .map((id) => ({ id, reason: "error", detail: "update returned no row" }));

  // 3. Audit each successful row.
  const patchedKeys = Object.keys(patch) as (keyof typeof patch)[];
  await Promise.all(
    afterRows.map(async (after) => {
      const before = beforeMap.get(after.id);
      const beforeDelta: Partial<BeforeRow> = {};
      const afterDelta: Partial<AfterRow> = {};
      for (const k of patchedKeys) {
        if (before && before[k as keyof BeforeRow] !== undefined) {
          (beforeDelta as Record<string, unknown>)[k] = before[k as keyof BeforeRow];
        }
        (afterDelta as Record<string, unknown>)[k] = after[k as keyof AfterRow];
      }
      await logAudit({
        action: PROPERTY_BULK_UPDATE,
        target_kind: "property",
        target_id: after.id,
        before: beforeDelta,
        after: afterDelta,
      });
    }),
  );

  return {
    status: "ok",
    succeeded: afterRows.map((r) => r.id),
    skipped: [...notVisibleSkipped, ...writeFailures],
  };
}
