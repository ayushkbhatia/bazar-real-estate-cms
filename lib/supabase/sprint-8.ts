/**
 * Escape-hatch type cast for Sprint 8 tables that aren't yet in
 * `db/types.ts`. Use sparingly: each new-table query file calls `s8(sb)`
 * once at the top, then operates on the typed-via-generic returns.
 *
 * Once `npm run db:types` runs against a real Bazar Supabase project,
 * the generated Database type will include these tables and `s8()` can
 * be removed — every callsite already shapes its rows via
 * `lib/types/sprint-8.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cast a typed Supabase client to a permissive one that accepts any
 * table string. The runtime client is unchanged; this only widens the
 * type so `.from("referrals")` etc. typecheck.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function s8(client: unknown): SupabaseClient<any, "public", any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as SupabaseClient<any, "public", any>;
}
