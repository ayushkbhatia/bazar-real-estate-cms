import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";

/**
 * Service-role Supabase client.
 *
 * Use ONLY for operations that must bypass RLS:
 *   • `auth.admin.inviteUserByEmail` (Phase 6a)
 *   • `auth.admin.listUsers` for the /admin/users page (cross-join staff
 *     ↔ auth.users metadata that RLS hides)
 *   • cron writes to notifications + concierge (Phase 6e)
 *
 * Returns `null` when `SUPABASE_SERVICE_ROLE_KEY` is missing — callers
 * should degrade gracefully (e.g. skip email-fetching, fall back to
 * showing display_name only).
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
