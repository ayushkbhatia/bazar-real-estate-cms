import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_kind: "user" | "system" | "integration";
  actor_email: string | null;
  actor_display_name: string | null;
  action: string;
  target_kind: string | null;
  target_id: string | null;
  before: unknown;
  after: unknown;
  at: string;
};

export type AuditLogFilters = {
  q: string | null;
  action: string | null;
  target_kind: string | null;
  actor_email: string | null;
  /** ISO date string (yyyy-mm-dd). */
  date_from: string | null;
  date_to: string | null;
};

export const EMPTY_AUDIT_FILTERS: AuditLogFilters = {
  q: null,
  action: null,
  target_kind: null,
  actor_email: null,
  date_from: null,
  date_to: null,
};

export function parseAuditFilters(
  input: Record<string, string | string[] | undefined>,
): AuditLogFilters {
  const get = (k: string) => {
    const v = input[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v[0]) return v[0];
    return null;
  };
  return {
    q: get("q"),
    action: get("action"),
    target_kind: get("target_kind"),
    actor_email: get("actor_email"),
    date_from: get("date_from"),
    date_to: get("date_to"),
  };
}

const PAGE_SIZE = 50;

type AuditQueryResult = {
  rows: AuditLogRow[];
  total: number;
  /** Distinct action values in the current filtered set (capped at 50 for
   *  the filter dropdown). */
  actions: string[];
  /** Distinct target kinds for the filter dropdown. */
  target_kinds: string[];
};

/** Read paginated audit_log rows + a few aggregate facets for the
 *  filter pills. Joins actor metadata (email + display_name) via the
 *  service-role admin client when available. */
export async function listAuditLog(
  filters: AuditLogFilters,
  page: number,
): Promise<AuditQueryResult> {
  if (!isSupabaseConfigured)
    return { rows: [], total: 0, actions: [], target_kinds: [] };

  const supabase = await createSupabaseServerClient();
  const safePage = Math.max(0, Math.floor(page));
  const offset = safePage * PAGE_SIZE;

  let query = supabase
    .from("audit_log")
    .select("id, actor_id, actor_kind, action, target_kind, target_id, before, after, at", {
      count: "exact",
    });

  if (filters.action) query = query.eq("action", filters.action);
  if (filters.target_kind) query = query.eq("target_kind", filters.target_kind);
  if (filters.date_from) query = query.gte("at", `${filters.date_from}T00:00:00Z`);
  if (filters.date_to) query = query.lte("at", `${filters.date_to}T23:59:59Z`);
  if (filters.q) {
    // Best-effort free-text search across action + target_id.
    query = query.or(
      `action.ilike.%${escapeIlike(filters.q)}%,target_id.ilike.%${escapeIlike(filters.q)}%`,
    );
  }
  query = query
    .order("at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error || !data) {
    if (error) console.error("[listAuditLog]", error);
    return { rows: [], total: 0, actions: [], target_kinds: [] };
  }

  // Faceted distinct values for filter dropdowns. Each is a small
  // independent query — Postgres handles them quickly via the indexes
  // on action + (target_kind, target_id).
  const [actionsResult, kindsResult] = await Promise.all([
    supabase
      .from("audit_log")
      .select("action")
      .order("action", { ascending: true })
      .limit(200),
    supabase
      .from("audit_log")
      .select("target_kind")
      .not("target_kind", "is", null)
      .order("target_kind", { ascending: true })
      .limit(200),
  ]);
  const actions = uniqueStringValues(
    (actionsResult.data ?? []).map((r) => r.action),
  ).slice(0, 50);
  const target_kinds = uniqueStringValues(
    (kindsResult.data ?? []).map((r) => r.target_kind),
  ).slice(0, 50);

  // Join actor metadata.
  const actorIds = Array.from(
    new Set(data.map((r) => r.actor_id).filter((v): v is string => !!v)),
  );
  const actorMeta = await fetchActorMetadata(actorIds);

  let rows: AuditLogRow[] = data.map((r) => {
    const meta = r.actor_id ? actorMeta.get(r.actor_id) : null;
    return {
      id: r.id,
      actor_id: r.actor_id,
      actor_kind: r.actor_kind,
      actor_email: meta?.email ?? null,
      actor_display_name: meta?.display_name ?? null,
      action: r.action,
      target_kind: r.target_kind,
      target_id: r.target_id,
      before: r.before,
      after: r.after,
      at: r.at,
    };
  });

  if (filters.actor_email) {
    const needle = filters.actor_email.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.actor_email ?? "").toLowerCase().includes(needle) ||
        (r.actor_display_name ?? "").toLowerCase().includes(needle),
    );
  }

  return { rows, total: count ?? rows.length, actions, target_kinds };
}

function uniqueStringValues(
  values: Array<string | null | undefined>,
): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (v) out.add(v);
  }
  return Array.from(out);
}

function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function fetchActorMetadata(
  ids: string[],
): Promise<Map<string, { email: string | null; display_name: string | null }>> {
  const out = new Map<string, { email: string | null; display_name: string | null }>();
  if (ids.length === 0) return out;
  try {
    const admin = createAdminClient();
    if (!admin) return out;
    // Single page is plenty — the staff table is tiny.
    const { data: users } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const wanted = new Set(ids);
    const emailByUser = new Map<string, string | null>();
    for (const u of users?.users ?? []) {
      if (wanted.has(u.id)) emailByUser.set(u.id, u.email ?? null);
    }
    // Display names live on the staff table — RLS doesn't block reads.
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
    console.warn("[audit fetchActorMetadata]", (err as Error).message);
  }
  return out;
}

/** Serialize rows into CSV. Pure — useful for the route + the tests. */
export function rowsToCsv(rows: AuditLogRow[]): string {
  const header = [
    "at",
    "actor_email",
    "actor_display_name",
    "actor_kind",
    "action",
    "target_kind",
    "target_id",
    "before",
    "after",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.at,
        r.actor_email ?? "",
        r.actor_display_name ?? "",
        r.actor_kind,
        r.action,
        r.target_kind ?? "",
        r.target_id ?? "",
        jsonCell(r.before),
        jsonCell(r.after),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

function csvCell(value: string): string {
  if (value === "") return "";
  // Quote when the cell contains a comma, quote, or newline.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function jsonCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export const AUDIT_PAGE_SIZE = PAGE_SIZE;
