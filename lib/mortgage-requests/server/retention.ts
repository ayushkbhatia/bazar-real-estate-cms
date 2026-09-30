import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MortgageStorage } from "./storage";

/**
 * Retention (SPEC §5 `retention.purge`; decision D7): a closed request's files
 * — the applicant's documents and the banks' letters — are deleted
 * `mortgage_settings.retention_months` after it closed. The objects leave the
 * bucket first, then their rows are kept as removed with no name (0151), and
 * the request's activity says how many went. The request itself stays.
 *
 * Nothing is due while the months are unset, which they are until compliance
 * answers D7. A run that stops halfway is safe to repeat: deleting an object
 * that's already gone isn't an error, and retiring a row twice does nothing.
 */

export type RetentionReport = {
  months: number | null;
  files: number;
  /** More were due than one run clears; the next run carries on. */
  remaining: boolean;
};

export async function purgeRetainedFiles(
  deps: { db: SupabaseClient; storage: MortgageStorage },
  opts: { months: number | null; batch?: number; maxBatches?: number },
): Promise<RetentionReport> {
  const months = opts.months && opts.months > 0 ? opts.months : null;
  if (!months) return { months: null, files: 0, remaining: false };
  const batch = opts.batch ?? 200;
  const maxBatches = opts.maxBatches ?? 10;

  let files = 0;
  for (let i = 0; i < maxBatches; i++) {
    const { data, error } = await deps.db.rpc("mortgage_retention_files", { p_months: months, p_limit: batch });
    if (error) throw new Error(`retention read failed: ${error.code}`);
    const due = (data ?? []) as { file_id: string; storage_key: string }[];
    if (due.length === 0) return { months, files, remaining: false };

    await deps.storage.remove(due.map((f) => f.storage_key));
    const { data: retired, error: retireError } = await deps.db.rpc("mortgage_retire_files", {
      p_file_ids: due.map((f) => f.file_id),
    });
    if (retireError) throw new Error(`retention retire failed: ${retireError.code}`);
    files += Number(retired ?? 0);
    if (due.length < batch) return { months, files, remaining: false };
  }
  return { months, files, remaining: true };
}
