"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
// Neutral module — the customer auth route group this used to import from
// has been removed along with customer accounts.
import { signOutAction } from "@/app/_actions/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { useAdminSession } from "@/app/(admin)/_components/admin-session";

type StaffSummary = {
  display_name: string;
  title: string | null;
  role: string | null;
};

/**
 * Sidebar user pile in CmsShell. Reads the signed-in staff row on mount
 * via the browser client, falls back to "Signed out" if no session.
 * Sprint 3 replaces the hardcoded "Mariam Al-Hashimi · Admin" placeholder.
 */
export function CmsUserPile() {
  // Inside /admin the layout already resolved this server-side, and the shell
  // mounts this component twice — so without the seed each navigation ran two
  // browser `getUser()` calls plus two `staff` selects for a name the page was
  // rendered with. Outside the provider the mount-time load below still runs.
  const session = useAdminSession();
  const seeded = session?.staff
    ? {
        display_name: session.staff.display_name,
        title: session.staff.title,
        role: session.staff.role,
      }
    : null;

  const [summary, setSummary] = useState<StaffSummary | null>(seeded);
  const [email, setEmail] = useState<string | null>(session?.email ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Seeded from the server — nothing to fetch. The auth-state subscription
    // below is still worth keeping so a sign-out in another tab updates this
    // one, but it costs nothing until it fires.
    if (session?.userId) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setSummary(null);
        setEmail(null);
        return;
      }
      setEmail(user.email ?? null);
      const { data } = await supabase
        .from("staff")
        .select("display_name, title, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setSummary(
        data ?? {
          display_name: user.email ?? "Staff",
          title: null,
          role: null,
        },
      );
    }
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [session?.userId]);

  const initials = (summary?.display_name ?? email ?? "·")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (!summary && !email) {
    return (
      <div className="flex items-center gap-2.5 px-2.5">
        <div className="w-8 h-8 rounded-full bg-bz-surface-3 text-bz-muted flex items-center justify-center text-[12px]">
          ·
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-bz-muted truncate">Signed out</div>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded hover:bg-bz-surface-2 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-bz-accent text-bz-accent-fg flex items-center justify-center text-[11px] font-medium">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium truncate">
              {summary?.display_name ?? email ?? "Staff"}
            </div>
            <div className="text-[11px] text-bz-muted capitalize">
              {summary?.role ?? "Staff"}
            </div>
          </div>
          <MoreVertical size={15} className="text-bz-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel>
          <div className="text-[11px] uppercase tracking-wider text-bz-muted">
            Signed in as
          </div>
          <div className="mt-0.5 text-[13px] truncate">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => signOutAction());
          }}
          disabled={pending}
        >
          <LogOut size={14} strokeWidth={1.7} />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
