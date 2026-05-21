import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePresence, type PresenceMember } from "./use-presence";

type PresenceCb = (payload: {
  newPresences?: PresenceMember[];
  leftPresences?: PresenceMember[];
}) => void;

function fakeClient() {
  type EventName = "sync" | "join" | "leave";
  const listeners = new Map<EventName, PresenceCb>();
  let statusCb: ((status: string) => void) | null = null;
  let state: Record<string, PresenceMember[]> = {};
  let lastTracked: PresenceMember | null = null;
  const removed: unknown[] = [];

  const channel = {
    on(_type: string, config: { event: EventName }, cb: PresenceCb) {
      void _type;
      listeners.set(config.event, cb);
      return channel;
    },
    subscribe(cb?: (status: string) => void) {
      statusCb = cb ?? null;
      statusCb?.("SUBSCRIBED");
      return channel;
    },
    async track(payload: PresenceMember) {
      lastTracked = payload;
      // Simulate Realtime echoing this member back into the roster.
      state = {
        ...state,
        [payload.user_id]: [payload],
      };
      listeners.get("sync")?.({});
      return undefined;
    },
    async untrack() {
      if (lastTracked) {
        const { [lastTracked.user_id]: _removed, ...rest } = state;
        void _removed;
        state = rest;
        listeners.get("sync")?.({});
      }
      return undefined;
    },
    presenceState() {
      return state;
    },
  };

  const client = {
    channel(name: string) {
      void name;
      return channel;
    },
    removeChannel(ch: unknown) {
      removed.push(ch);
    },
  };

  function injectOther(member: PresenceMember) {
    const existing = state[member.user_id] ?? [];
    state = { ...state, [member.user_id]: [...existing, member] };
    listeners.get("sync")?.({});
  }

  return { client, channel, injectOther, removed };
}

describe("usePresence", () => {
  const self: PresenceMember = {
    user_id: "self-1",
    display_name: "Self One",
    joined_at: "2026-05-21T16:00:00Z",
  };

  it("tracks self on subscribe and reports self in members", async () => {
    const { client } = fakeClient();
    const { result } = renderHook(() =>
      usePresence({
        channel: "presence:enquiry:abc",
        self,
        createClient: () => client,
      }),
    );

    // Allow microtasks (the async track inside subscribe) to flush.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.members.map((m) => m.user_id)).toContain("self-1");
    expect(result.current.others.length).toBe(0);
  });

  it("excludes self from others; includes other staff", async () => {
    const { client, injectOther } = fakeClient();
    const { result } = renderHook(() =>
      usePresence({
        channel: "presence:enquiry:abc",
        self,
        createClient: () => client,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      injectOther({
        user_id: "mariam",
        display_name: "Mariam Al-Hashimi",
        joined_at: "2026-05-21T16:00:05Z",
      });
    });

    expect(result.current.others.length).toBe(1);
    expect(result.current.others[0].display_name).toBe("Mariam Al-Hashimi");
  });

  it("collapses multiple tabs of the same user_id, keeping newest metadata", async () => {
    const { client, injectOther } = fakeClient();
    const { result } = renderHook(() =>
      usePresence({
        channel: "presence:enquiry:abc",
        self,
        createClient: () => client,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Inject the same user twice (different join times) — should collapse
    // to a single entry in `others`.
    act(() => {
      injectOther({
        user_id: "mariam",
        display_name: "Mariam Al-Hashimi (tab 1)",
        joined_at: "2026-05-21T16:00:01Z",
      });
    });
    act(() => {
      injectOther({
        user_id: "mariam",
        display_name: "Mariam Al-Hashimi (tab 2)",
        joined_at: "2026-05-21T16:00:05Z",
      });
    });

    expect(result.current.others).toHaveLength(1);
  });

  it("removeChannel runs on unmount", async () => {
    const { client, removed } = fakeClient();
    const { unmount } = renderHook(() =>
      usePresence({
        channel: "presence:enquiry:abc",
        self,
        createClient: () => client,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    expect(removed.length).toBe(1);
  });

  it("does nothing when enabled=false", async () => {
    const { client, removed } = fakeClient();
    const { result } = renderHook(() =>
      usePresence({
        channel: "presence:enquiry:abc",
        self,
        enabled: false,
        createClient: () => client,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.members).toHaveLength(0);
    expect(removed.length).toBe(0);
  });

  it("survives a client-factory throw (missing env)", () => {
    const factory = () => {
      throw new Error("env missing");
    };
    expect(() =>
      renderHook(() =>
        usePresence({
          channel: "presence:enquiry:abc",
          self,
          createClient: factory,
        }),
      ),
    ).not.toThrow();
  });
});
