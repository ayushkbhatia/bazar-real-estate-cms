"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type PresenceMember = {
  user_id: string;
  display_name: string;
  joined_at: string;
  photo_url?: string | null;
  // Anything extra a caller wants to track.
  [extra: string]: unknown;
};

type PresenceEventCb = (payload: {
  newPresences?: PresenceMember[];
  leftPresences?: PresenceMember[];
}) => void;

type ChannelLike = {
  on: (
    type: "presence",
    config: { event: "sync" | "join" | "leave" },
    cb: PresenceEventCb,
  ) => ChannelLike;
  subscribe: (cb?: (status: string) => void) => ChannelLike;
  track: (payload: PresenceMember) => Promise<unknown>;
  untrack: () => Promise<unknown>;
  presenceState: () => Record<string, PresenceMember[]>;
};

type ClientLike = {
  channel: (
    name: string,
    config?: { config?: { presence?: { key?: string } } },
  ) => ChannelLike;
  removeChannel: (ch: ChannelLike) => unknown;
};

export type UsePresenceOptions = {
  /** Channel name. Convention: `presence:<scope>:<id>`. */
  channel: string;
  /** Identity payload broadcast on join. */
  self: PresenceMember;
  /** Toggle without remount. */
  enabled?: boolean;
  /** Test seam — inject a fake Supabase client. */
  createClient?: () => ClientLike;
};

export type UsePresenceResult = {
  /** All present members (deduped by user_id; multiple tabs collapse to one). */
  members: PresenceMember[];
  /** Members excluding self.user_id. */
  others: PresenceMember[];
  /** Whether the channel is currently SUBSCRIBED. */
  connected: boolean;
};

/**
 * Collapse a channel's `presenceState()` into a sorted, deduped roster:
 * one member per user_id (newest metadata wins), earliest joiner first.
 */
function computeRoster(ch: ChannelLike): PresenceMember[] {
  const state = ch.presenceState();
  const collapsed: PresenceMember[] = [];
  for (const key of Object.keys(state)) {
    const entries = state[key] ?? [];
    if (entries.length === 0) continue;
    const newest = entries.reduce((acc, e) => {
      const accAt = Date.parse(String(acc.joined_at ?? "")) || 0;
      const eAt = Date.parse(String(e.joined_at ?? "")) || 0;
      return eAt > accAt ? e : acc;
    });
    collapsed.push(newest);
  }
  collapsed.sort((a, b) => {
    const aAt = Date.parse(String(a.joined_at ?? "")) || 0;
    const bAt = Date.parse(String(b.joined_at ?? "")) || 0;
    return aAt - bAt;
  });
  return collapsed;
}

/**
 * Per-tab shared presence channels, keyed by topic (channel name).
 *
 * The browser Supabase client is a singleton, and `client.channel(topic)`
 * returns the *existing* channel for a topic — so a second consumer of the
 * same topic that calls `.on("presence", …)` after the first has already
 * `.subscribe()`d throws "cannot add presence callbacks … after subscribe()",
 * which escapes the effect and takes down the page via the error boundary.
 *
 * Presence rooms MUST use an identical topic across browsers (that's how
 * viewers see each other), so — unlike postgres_changes — we can't hand each
 * mount a unique topic. Instead we reference-count ONE real subscription per
 * topic and fan its roster/connection state out to every hook. The CMS shell
 * renders PresencePile in both the desktop and mobile chrome, plus the body
 * renders a PresenceBanner: all three now share a single channel.
 */
type RosterCb = (members: PresenceMember[]) => void;
type ConnCb = (connected: boolean) => void;

type SharedPresence = {
  channel: ChannelLike;
  client: ClientLike;
  refCount: number;
  members: PresenceMember[];
  connected: boolean;
  rosterSubs: Set<RosterCb>;
  connSubs: Set<ConnCb>;
  /** Removes the beforeunload listener registered for this channel. */
  detach: () => void;
};

const sharedPresence = new Map<string, SharedPresence>();

function acquirePresence(
  channelName: string,
  identity: PresenceMember,
  factory: () => ClientLike,
): SharedPresence {
  const existing = sharedPresence.get(channelName);
  if (existing) {
    existing.refCount += 1;
    return existing;
  }

  const client = factory();
  const ch = client.channel(channelName, {
    config: { presence: { key: identity.user_id } },
  });

  const entry: SharedPresence = {
    channel: ch,
    client,
    refCount: 1,
    members: [],
    connected: false,
    rosterSubs: new Set(),
    connSubs: new Set(),
    detach: () => {},
  };

  const recompute = () => {
    entry.members = computeRoster(ch);
    entry.rosterSubs.forEach((cb) => cb(entry.members));
  };

  ch.on("presence", { event: "sync" }, recompute)
    .on("presence", { event: "join" }, recompute)
    .on("presence", { event: "leave" }, recompute)
    .subscribe(async (status) => {
      const subscribed = status === "SUBSCRIBED";
      entry.connected = subscribed;
      entry.connSubs.forEach((cb) => cb(subscribed));
      if (subscribed) {
        // Failing to track ourselves means presence is broken for this
        // viewer — worth knowing about. Don't crash the page over it.
        await ch.track(identity).catch((err: unknown) => {
          Sentry.captureException(err, {
            tags: { component: "realtime/presence", op: "track" },
          });
        });
      }
    });

  // Best-effort untrack on tab close — Realtime also notices the socket
  // drop, but this is faster for clean closes.
  const onBeforeUnload = () => {
    ch.untrack().catch(() => {
      Sentry.addBreadcrumb({
        category: "realtime/presence",
        message: "untrack failed during beforeunload",
        level: "info",
      });
    });
  };
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", onBeforeUnload);
  }
  entry.detach = () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", onBeforeUnload);
    }
  };

  sharedPresence.set(channelName, entry);
  return entry;
}

function releasePresence(channelName: string): void {
  const entry = sharedPresence.get(channelName);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount > 0) return;

  // Last consumer gone — tear the real subscription down.
  sharedPresence.delete(channelName);
  entry.detach();
  entry.channel.untrack().catch(() => {
    Sentry.addBreadcrumb({
      category: "realtime/presence",
      message: "untrack failed during cleanup",
      level: "info",
    });
  });
  entry.client.removeChannel(entry.channel);
}

/**
 * Supabase Realtime presence. Joins the named channel with the caller's
 * identity, tracks the live roster, and exposes a deduped `others` array
 * for "X is also viewing this" UIs.
 *
 * Multiple hooks on the same channel within a tab share one underlying
 * subscription (see `acquirePresence`). Untracks on unmount and tab close
 * once the last consumer for a channel goes away.
 */
export function usePresence({
  channel: channelName,
  self,
  enabled = true,
  createClient,
}: UsePresenceOptions): UsePresenceResult {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [connected, setConnected] = useState(false);

  const selfRef = useRef(self);
  const createClientRef = useRef(createClient);
  useLayoutEffect(() => {
    selfRef.current = self;
    createClientRef.current = createClient;
  });

  useEffect(() => {
    if (!enabled) return;

    let entry: SharedPresence;
    try {
      const factory =
        createClientRef.current ??
        (createSupabaseBrowserClient as unknown as () => ClientLike);
      entry = acquirePresence(channelName, selfRef.current, factory);
    } catch {
      // Supabase env not configured (preview build without secrets) — skip
      // presence; the caller renders its default empty state.
      return;
    }

    const onRoster: RosterCb = (m) => setMembers(m);
    const onConn: ConnCb = (c) => setConnected(c);
    entry.rosterSubs.add(onRoster);
    entry.connSubs.add(onConn);
    // Adopt whatever state the (possibly pre-existing) channel already has,
    // so a hook that joins an already-subscribed channel isn't stuck empty.
    setMembers(entry.members);
    setConnected(entry.connected);

    return () => {
      entry.rosterSubs.delete(onRoster);
      entry.connSubs.delete(onConn);
      releasePresence(channelName);
      setConnected(false);
    };
  }, [channelName, enabled]);

  const selfId = self.user_id;
  const others = members.filter((m) => m.user_id !== selfId);

  return { members, others, connected };
}
