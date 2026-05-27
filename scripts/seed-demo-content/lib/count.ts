import { adminClient } from "./client.ts";

/** Quickly count rows in a table for before/after summaries. */
export async function countRows(table: string, filter?: { col: string; val: string }): Promise<number> {
  const supabase = adminClient();
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = q.eq(filter.col, filter.val);
  const { count, error } = await q;
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}
