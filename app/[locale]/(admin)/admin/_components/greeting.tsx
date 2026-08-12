"use client";

import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Sprint 7a (backfilled): personalised dashboard greeting. Reads the
 * signed-in staff's display name on mount and adapts the time-of-day
 * salutation.
 */
export function DashboardGreeting() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const { data } = await supabase
        .from("staff")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const first =
        (data?.display_name as string | undefined)?.split(" ")[0] ??
        (user.email?.split("@")[0] ?? "Advisor");
      setName(first);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazy initialiser keeps Date.now() / new Date() out of the render body.
  const [salutation] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  });

  return (
    <div>
      <Eyebrow>Workspace</Eyebrow>
      <h1
        className="serif text-[32px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        {salutation}, {name ?? "advisor"}.
      </h1>
    </div>
  );
}
