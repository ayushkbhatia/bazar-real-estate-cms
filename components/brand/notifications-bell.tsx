"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAdminSession } from "@/app/[locale]/(admin)/_components/admin-session";

export type BellNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type BellProps = {
  /** Pre-populated state from a server fetch. Optional — when omitted, the
   *  bell fetches /api/notifications/recent on mount instead. */
  initial?: BellNotification[];
  unreadCount?: number;
  /** Current user's id — needed for the Realtime filter. */
  userId?: string | null;
};

const KIND_DOT_COLOUR: Record<string, string> = {
  new_enquiry: "bg-bz-accent",
  viewing_reminder: "bg-[oklch(0.6_0.12_145)]",
  lead_reassigned: "bg-[oklch(0.7_0.13_60)]",
  system: "bg-bz-muted-2",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function NotificationsBell({
  initial,
  unreadCount,
  userId: userIdProp,
}: BellProps) {
  // The admin layout resolves all three of these on the server and hands them
  // down, so the mount-time fetch below never runs inside /admin. Explicit
  // props still win — they're how a caller overrides the shared session — and
  // the self-fetch remains the fallback for any mount outside the provider.
  const session = useAdminSession();
  const seededRows = initial ?? session?.notifications ?? [];
  const seededUnread = unreadCount ?? session?.unread ?? 0;
  const seededUserId = userIdProp ?? session?.userId ?? null;

  const [rows, setRows] = useState<BellNotification[]>(seededRows);
  const [unread, setUnread] = useState(seededUnread);
  const [userId, setUserId] = useState<string | null>(seededUserId);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Per-instance suffix so two concurrent bells (the CMS shell renders one
  // in the desktop topbar and one in the mobile app bar) don't collide on
  // the same realtime channel. `client.channel(topic)` reuses an existing
  // subscribed channel, and calling `.on()` on it after `.subscribe()`
  // throws — which would take down the whole admin shell via the error
  // boundary. A unique topic per mount keeps each subscription independent.
  const instanceId = useId();

  // Self-populate on mount only when nothing seeded us — no prop and no admin
  // session. Inside /admin the layout always seeds, so this is dead weight
  // there; it stays for any mount outside the provider.
  useEffect(() => {
    if (seededUserId) return;
    let cancelled = false;
    fetch("/api/notifications/recent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          json: {
            rows: BellNotification[];
            unread: number;
            userId: string | null;
          } | null,
        ) => {
          if (cancelled || !json) return;
          setRows(json.rows ?? []);
          setUnread(json.unread ?? 0);
          setUserId(json.userId ?? null);
        },
      )
      .catch(() => {
        // Network fail is fine — the bell stays empty until next mount.
      });
    return () => {
      cancelled = true;
    };
  }, [seededUserId]);

  // Subscribe to Realtime inserts/updates for this user's notifications.
  useEffect(() => {
    if (!userId) return;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      // Supabase env not configured (preview build without secrets) —
      // skip realtime; the bell still renders the SSR snapshot.
      return;
    }
    const channel = supabase
      .channel(`notifications:${userId}::${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: BellNotification }) => {
          setRows((prev) => [payload.new, ...prev].slice(0, 20));
          if (!payload.new.read_at) setUnread((n) => n + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: BellNotification }) => {
          setRows((prev) =>
            prev.map((r) => (r.id === payload.new.id ? payload.new : r)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);

  function markOne(id: string) {
    startTransition(async () => {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, read_at: new Date().toISOString() } : r,
          ),
        );
        setUnread((n) => Math.max(0, n - 1));
      }
    });
  }

  function markAll() {
    startTransition(async () => {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setRows((prev) =>
          prev.map((r) => ({ ...r, read_at: r.read_at ?? now })),
        );
        setUnread(0);
      }
    });
  }

  const visibleUnread = useMemo(() => Math.min(unread, 99), [unread]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unread > 0 ? `${unread} unread notifications` : "Notifications"
          }
          className="relative"
        >
          <Bell size={15} strokeWidth={1.6} />
          {unread > 0 ? (
            <span
              className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] inline-flex items-center justify-center px-1 rounded-full bg-bz-accent text-white text-[9px] font-semibold leading-none"
              aria-hidden
            >
              {visibleUnread}
              {unread > 99 ? "+" : ""}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bz-border">
          <div>
            <div className="text-[13px] font-medium">Notifications</div>
            <div className="text-[11px] text-bz-muted">
              {unread === 0 ? "All caught up" : `${unread} unread`}
            </div>
          </div>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              disabled={pending}
              className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
            >
              <CheckCheck size={12} strokeWidth={1.8} />
              Mark all read
            </button>
          ) : null}
        </div>
        <ul className="max-h-[420px] overflow-auto">
          {rows.length === 0 ? (
            <li className="px-4 py-12 text-center text-[12.5px] text-bz-muted">
              No notifications yet. New enquiries and viewing reminders will
              appear here.
            </li>
          ) : (
            rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex gap-3 px-4 py-3 border-b border-bz-border last:border-b-0 hover:bg-bz-surface-2 transition-colors",
                  row.read_at ? "opacity-70" : "",
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mt-2 shrink-0",
                    KIND_DOT_COLOUR[row.kind] ?? "bg-bz-muted-2",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium truncate">
                      {row.title}
                    </span>
                    <span className="text-[10.5px] text-bz-muted shrink-0 mono">
                      {relativeTime(row.created_at)}
                    </span>
                  </div>
                  {row.body ? (
                    <div className="text-[11.5px] text-bz-muted mt-0.5 line-clamp-2">
                      {row.body}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3 mt-1.5">
                    {row.link ? (
                      <Link
                        href={row.link}
                        className="text-[11.5px] text-bz-ink hover:text-bz-accent"
                        onClick={() => setOpen(false)}
                      >
                        Open
                      </Link>
                    ) : null}
                    {!row.read_at ? (
                      <button
                        type="button"
                        onClick={() => markOne(row.id)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
                      >
                        <Check size={11} strokeWidth={1.8} />
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
