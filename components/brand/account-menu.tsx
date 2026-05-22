"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { signOutAction } from "@/app/(public)/(auth)/_actions";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Right-side account control for PublicNav. When signed in, renders a
 * dropdown linking the account sections that exist; when signed out,
 * renders a plain "Sign in" link.
 *
 * Self-contained: subscribes to auth state on the browser client so the
 * layout (RSC) doesn't have to thread session state through props.
 */
export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) setEmail(session?.user?.email ?? null);
      },
    );

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!email) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  const initial = email[0]?.toUpperCase() ?? "·";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md text-[13px] text-bz-ink-2 hover:bg-bz-surface-2 transition-colors"
        >
          <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-bz-accent text-bz-accent-fg text-[11px] font-medium">
            {initial}
          </span>
          <ChevronDown size={13} strokeWidth={1.7} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        sideOffset={6}
      >
        <DropdownMenuLabel>
          <div className="text-[11px] uppercase tracking-wider text-bz-muted">
            Signed in as
          </div>
          <div className="mt-0.5 text-[13px] truncate">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/saved">Saved</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/viewings">Viewings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/enquiries">Enquiries</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/documents">Documents</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/profile">
            <User size={14} strokeWidth={1.7} />
            Profile
          </Link>
        </DropdownMenuItem>
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
