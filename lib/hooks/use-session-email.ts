"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Subscribe to the signed-in user's email on the browser client.
 *
 * Returns `null` while loading, when signed out, or when Supabase isn't
 * configured — callers treat "no email" as "signed out". Mirrors the
 * self-contained auth subscription in `components/brand/account-menu.tsx`
 * so client chrome can react to auth state without threading session
 * through RSC props; extracted to a hook so the mobile drawer footer can
 * share it.
 */
export function useSessionEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setEmail(session?.user?.email ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return email;
}
