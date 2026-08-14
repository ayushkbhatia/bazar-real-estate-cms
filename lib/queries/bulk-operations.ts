import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * One row per bulk action. `audit_log` already captures the per-id rows
 * (e.g. one `property.bulk_update` row per property); `bulk_operations`
 * adds the summary index so the audit-log viewer's `?kind=bulk` filter
 * can list "the archives Mariam ran yesterday" in one screenful.
 */

export type BulkOperationKind =
  | "bulk_update"
  | "bulk_publish"
  | "bulk_off_market"
  | "bulk_reassign"
  | "bulk_archive";

export type BulkOperationRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_display_name: string | null;
  action: BulkOperationKind;
  target_kind: string;
  target_count: number;
  succeeded: string[];
  skipped: { id: string; reason: string }[];
  payload: Record<string, unknown> | null;
  created_at: string;
};

export const BULK_OPERATIONS_PAGE_SIZE = 50;

/** Append a row to `bulk_operations`. Best-effort — same swallow-and-warn
 *  pattern as `logAudit` so a failed log write never blocks the user
 *  flow. */
export async function logBulkOperation(entry: {
  action: BulkOperationKind;
  target_kind?: string;
  target_count: number;
  succeeded: string[];
  skipped: { id: string; reason: string }[];
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = await createSupabaseServerClient();
    // Request-cached: the caller almost always resolved the same user already.
    const user = await getCurrentUser();
    if (!user) return;
    // Cast through unknown — db/types.ts is regenerated separately from
    // migrations, so bulk_operations isn't in the generated types yet.
    const client = supabase as unknown as {
      from: (table: "bulk_operations") => {
        insert: (
          row: Record<string, unknown>,
        ) => PromiseLike<{ error: { message: string } | null }>;
      };
    };
    const { error } = await client.from("bulk_operations").insert({
      actor_id: user.id,
      action: entry.action,
      target_kind: entry.target_kind ?? "property",
      target_count: entry.target_count,
      succeeded: entry.succeeded,
      skipped: entry.skipped,
      payload: entry.payload ?? null,
    });
    if (error) {
      console.warn(
        "[bulk-operations] insert failed",
        entry.action,
        error.message,
      );
    }
  } catch (err) {
    console.warn("[bulk-operations] threw", (err as Error).message);
  }
}

/** Read paginated `bulk_operations` rows for the audit-log viewer.
 *  Joins actor metadata via the service-role admin client (same shape
 *  as `listAuditLog`). */
export async function listBulkOperations(
  page: number,
): Promise<{ rows: BulkOperationRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  const safePage = Math.max(0, Math.floor(page));
  const offset = safePage * BULK_OPERATIONS_PAGE_SIZE;

  type Raw = {
    id: string;
    actor_id: string | null;
    action: BulkOperationKind;
    target_kind: string;
    target_count: number;
    succeeded: unknown;
    skipped: unknown;
    payload: unknown;
    created_at: string;
  };

  const client = supabase as unknown as {
    from: (table: "bulk_operations") => {
      select: (
        cols: string,
        opts?: { count?: "exact" },
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          range: (
            a: number,
            b: number,
          ) => PromiseLike<{
            data: Raw[] | null;
            count: number | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data, count, error } = await client
    .from("bulk_operations")
    .select(
      "id, actor_id, action, target_kind, target_count, succeeded, skipped, payload, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + BULK_OPERATIONS_PAGE_SIZE - 1);
  if (error || !data) {
    if (error) console.error("[listBulkOperations]", error);
    return { rows: [], total: 0 };
  }

  const actorIds = Array.from(
    new Set(data.map((r) => r.actor_id).filter((v): v is string => !!v)),
  );
  const actorMeta = await fetchActorMetadata(actorIds);

  const rows: BulkOperationRow[] = data.map((r) => {
    const meta = r.actor_id ? actorMeta.get(r.actor_id) : null;
    return {
      id: r.id,
      actor_id: r.actor_id,
      actor_email: meta?.email ?? null,
      actor_display_name: meta?.display_name ?? null,
      action: r.action,
      target_kind: r.target_kind,
      target_count: r.target_count,
      succeeded: Array.isArray(r.succeeded) ? (r.succeeded as string[]) : [],
      skipped: Array.isArray(r.skipped)
        ? (r.skipped as { id: string; reason: string }[])
        : [],
      payload: (r.payload as Record<string, unknown> | null) ?? null,
      created_at: r.created_at,
    };
  });

  return { rows, total: count ?? rows.length };
}

async function fetchActorMetadata(
  ids: string[],
): Promise<Map<string, { email: string | null; display_name: string | null }>> {
  const out = new Map<
    string,
    { email: string | null; display_name: string | null }
  >();
  if (ids.length === 0) return out;
  try {
    const admin = createAdminClient();
    if (!admin) return out;
    const { data: users } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const wanted = new Set(ids);
    const emailByUser = new Map<string, string | null>();
    for (const u of users?.users ?? []) {
      if (wanted.has(u.id)) emailByUser.set(u.id, u.email ?? null);
    }
    const { data: staffRows } = await admin
      .from("staff")
      .select("user_id, display_name")
      .in("user_id", ids);
    const nameByUser = new Map<string, string | null>(
      (staffRows ?? []).map((r) => [r.user_id, r.display_name]),
    );
    for (const id of ids) {
      out.set(id, {
        email: emailByUser.get(id) ?? null,
        display_name: nameByUser.get(id) ?? null,
      });
    }
  } catch (err) {
    console.warn(
      "[bulk-operations fetchActorMetadata]",
      (err as Error).message,
    );
  }
  return out;
}
