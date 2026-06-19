"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type PostgresChangeEvent = "*" | "INSERT" | "UPDATE" | "DELETE";

type PostgresPayload = {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type ChannelLike = {
  on: (
    type: "postgres_changes",
    config: { event: PostgresChangeEvent; schema: string; table: string; filter?: string },
    cb: (payload: PostgresPayload) => void,
  ) => ChannelLike;
  subscribe: (cb?: (status: string) => void) => ChannelLike;
};

type ClientLike = {
  channel: (name: string) => ChannelLike;
  removeChannel: (ch: ChannelLike) => unknown;
};

/**
 * Leading-edge throttle with a trailing flush. The first call inside an idle
 * window fires immediately; further calls during the window schedule a single
 * trailing call at window end. Result: at most one flush per `ms` window.
 *
 * Exported for direct testing.
 */
export function createThrottle(flush: () => void, ms: number) {
  let lastFireAt = 0;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function trigger() {
    if (disposed) return;
    const now = Date.now();
    const since = now - lastFireAt;
    if (since >= ms) {
      lastFireAt = now;
      flush();
      return;
    }
    if (trailingTimer == null) {
      trailingTimer = setTimeout(() => {
        if (disposed) return;
        trailingTimer = null;
        lastFireAt = Date.now();
        flush();
      }, ms - since);
    }
  }

  function dispose() {
    disposed = true;
    if (trailingTimer != null) {
      clearTimeout(trailingTimer);
      trailingTimer = null;
    }
  }

  return { trigger, dispose };
}

export type UsePostgresChangesOptions = {
  /** Realtime channel name (must be unique per subscription scope). */
  channel: string;
  /** Postgres table to watch. */
  table: string;
  /** Schema — defaults to "public". */
  schema?: string;
  /** Postgres filter expression, e.g. `user_id=eq.<uuid>`. */
  filter?: string;
  /** Event type — defaults to "*" (INSERT + UPDATE + DELETE). */
  event?: PostgresChangeEvent;
  /** Throttle window in ms. Defaults to 250. */
  throttleMs?: number;
  /** Toggle subscription on/off without remounting. */
  enabled?: boolean;
  /** Optional per-event side effect (e.g. play chime). Not throttled. */
  onEvent?: (payload: PostgresPayload) => void;
  /** Test seam — inject a fake Supabase client. */
  createClient?: () => ClientLike;
  /** Test seam — override `router.refresh()`. */
  refresh?: () => void;
};

export type UsePostgresChangesResult = {
  /** ms timestamp of most recent event (or null). Drives the "Live" pulse. */
  lastEventAt: number | null;
  /** Whether the channel is currently subscribed. */
  connected: boolean;
};

/**
 * Subscribe a Client Component to Postgres changes for a single table+filter
 * combo. Bursts are throttled to one `router.refresh()` per 250ms window so a
 * surrounding RSC re-renders with fresh data — no optimistic state.
 *
 * Cleans up on unmount. Silently no-ops when Supabase env is unset (preview
 * builds without secrets).
 */
export function usePostgresChanges({
  channel: channelName,
  table,
  schema = "public",
  filter,
  event = "*",
  throttleMs = 250,
  enabled = true,
  onEvent,
  createClient,
  refresh,
}: UsePostgresChangesOptions): UsePostgresChangesResult {
  const router = useRouter();
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  // Supabase's browser client is a singleton and `client.channel(topic)`
  // returns the *existing* channel for a topic that's already been
  // subscribed — so if the same logical channel is mounted twice at once
  // (e.g. the CMS shell renders its topbar in both the desktop and mobile
  // chrome trees), the second mount's `.on(...)` lands after the first's
  // `.subscribe()` and throws "cannot add postgres_changes callbacks
  // after subscribe()". A per-instance suffix gives every mount its own
  // channel, so concurrent duplicates each subscribe independently.
  const instanceId = useId();

  // Stash callbacks + factories in refs so we don't tear down the
  // subscription every time the parent re-renders with a fresh arrow.
  const onEventRef = useRef(onEvent);
  const createClientRef = useRef(createClient);
  const refreshRef = useRef(refresh);
  const routerRef = useRef(router);
  useLayoutEffect(() => {
    onEventRef.current = onEvent;
    createClientRef.current = createClient;
    refreshRef.current = refresh;
    routerRef.current = router;
  });

  useEffect(() => {
    if (!enabled) return;

    let client: ClientLike;
    try {
      const factory =
        createClientRef.current ??
        (createSupabaseBrowserClient as unknown as () => ClientLike);
      client = factory();
    } catch {
      return;
    }

    const doRefresh =
      refreshRef.current ?? (() => routerRef.current.refresh());
    const throttle = createThrottle(doRefresh, throttleMs);

    const filterPayload: {
      event: PostgresChangeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = { event, schema, table };
    if (filter) filterPayload.filter = filter;

    const ch = client
      .channel(`${channelName}::${instanceId}`)
      .on("postgres_changes", filterPayload, (payload) => {
        setLastEventAt(Date.now());
        onEventRef.current?.(payload);
        throttle.trigger();
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      throttle.dispose();
      client.removeChannel(ch);
      setConnected(false);
    };
  }, [channelName, instanceId, table, schema, filter, event, throttleMs, enabled]);

  return { lastEventAt, connected };
}
