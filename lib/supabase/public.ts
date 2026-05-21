import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";

/**
 * Cookie-free anon-key client for fully-public reads (featured listings,
 * area pages, blog index). Lets RSC pages stay statically generated with
 * ISR — no `cookies()` call means no dynamic-server bailout.
 *
 * Use createSupabaseServerClient for anything auth-sensitive.
 */
export function createSupabasePublicClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch },
    },
  );
}
