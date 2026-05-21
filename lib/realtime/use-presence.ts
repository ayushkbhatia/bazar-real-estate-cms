"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * Supabase Realtime presence. Joins the named channel with the caller's
 * identity, tracks the live roster, and exposes a deduped `others` array
 * for "X is also viewing this" UIs.
 *
 * Untracks on unmount and tab close.
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

    let client: ClientLike;
    try {
      const factory =
        createClientRef.current ??
        (createSupabaseBrowserClient as unknown as () => ClientLike);
      client = factory();
    } catch {
      return;
    }

    const identity = selfRef.current;
    const ch = client.channel(channelName, {
      config: { presence: { key: identity.user_id } },
    });

    const recomputeRoster = () => {
      const state = ch.presenceState();
      // Each presence key is user_id and may have multiple entries (one per
      // tab). Collapse to a single member per key, preferring the most-recently
      // joined entry's metadata.
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
      // Stable sort: earliest joiner first.
      collapsed.sort((a, b) => {
        const aAt = Date.parse(String(a.joined_at ?? "")) || 0;
        const bAt = Date.parse(String(b.joined_at ?? "")) || 0;
        return aAt - bAt;
      });
      setMembers(collapsed);
    };

    ch.on("presence", { event: "sync" }, recomputeRoster)
      .on("presence", { event: "join" }, recomputeRoster)
      .on("presence", { event: "leave" }, recomputeRoster)
      .subscribe(async (status) => {
        const subscribed = status === "SUBSCRIBED";
        setConnected(subscribed);
        if (subscribed) {
          await ch.track(identity).catch(() => {});
        }
      });

    // Best-effort untrack on tab close — Realtime also notices the socket
    // drop, but this is faster for clean closes.
    const onBeforeUnload = () => {
      ch.untrack().catch(() => {});
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", onBeforeUnload);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", onBeforeUnload);
      }
      ch.untrack().catch(() => {});
      client.removeChannel(ch);
      setConnected(false);
    };
  }, [channelName, enabled]);

  const selfId = self.user_id;
  const others = members.filter((m) => m.user_id !== selfId);

  return { members, others, connected };
}
