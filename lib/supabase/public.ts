import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { resilientFetch } from "./resilient-fetch";
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
      // Not the bare platform `fetch`. This client is what `npm run build`
      // reads Supabase through on all 837 prerendered pages, and `fetch` has
      // no timeout — so a connection that hangs holds the route open until
      // Next's 60s budget expires and the whole deploy fails. Two builds died
      // that way on 2026-09-03. See `resilient-fetch.ts`; the per-attempt
      // deadline is the part that matters, the retry is the easy half.
      global: { fetch: resilientFetch },
    },
  );
}
