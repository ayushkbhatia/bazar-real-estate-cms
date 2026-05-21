import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createThrottle, usePostgresChanges } from "./use-postgres-changes";

// next/navigation in vitest needs a stub — the hook calls useRouter().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

type FakePayload = {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

function fakeClient() {
  type Listener = (payload: FakePayload) => void;
  let listener: Listener | null = null;
  let statusCb: ((status: string) => void) | null = null;
  const channels: unknown[] = [];
  const removed: unknown[] = [];

  const channel = {
    on(_type: string, _config: unknown, cb: Listener) {
      listener = cb;
      return channel;
    },
    subscribe(cb?: (status: string) => void) {
      statusCb = cb ?? null;
      // Simulate immediate SUBSCRIBED callback.
      statusCb?.("SUBSCRIBED");
      return channel;
    },
  };

  const client = {
    channel(name: string) {
      void name;
      channels.push(channel);
      return channel;
    },
    removeChannel(ch: unknown) {
      removed.push(ch);
    },
  };

  function emit(eventType: "INSERT" | "UPDATE" | "DELETE" = "INSERT") {
    listener?.({
      schema: "public",
      table: "fake",
      commit_timestamp: new Date().toISOString(),
      eventType,
      new: {},
      old: {},
    });
  }

  return { client, emit, channels, removed };
}

describe("createThrottle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once on leading edge for a single trigger", () => {
    const flush = vi.fn();
    const t = createThrottle(flush, 250);
    t.trigger();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("fires at most once per 250ms window under burst load (10 events)", () => {
    const flush = vi.fn();
    const t = createThrottle(flush, 250);

    // 10 events synchronously at t=0 — leading-edge fires once.
    for (let i = 0; i < 10; i++) t.trigger();
    expect(flush).toHaveBeenCalledTimes(1);

    // Window still open: another event mid-window does not fire.
    vi.advanceTimersByTime(100);
    t.trigger();
    expect(flush).toHaveBeenCalledTimes(1);

    // Cross the 250ms boundary — trailing flush fires.
    vi.advanceTimersByTime(200);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("fires leading again after the window has elapsed without traffic", () => {
    const flush = vi.fn();
    const t = createThrottle(flush, 250);
    t.trigger();
    expect(flush).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);
    t.trigger();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("dispose() cancels any pending trailing flush", () => {
    const flush = vi.fn();
    const t = createThrottle(flush, 250);
    t.trigger();
    t.trigger();
    expect(flush).toHaveBeenCalledTimes(1);

    t.dispose();
    vi.advanceTimersByTime(500);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe("usePostgresChanges", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("subscribes to the channel and refreshes on events", () => {
    const { client, emit } = fakeClient();
    const refresh = vi.fn();

    renderHook(() =>
      usePostgresChanges({
        channel: "test:enquiries",
        table: "enquiries",
        createClient: () => client,
        refresh,
      }),
    );

    expect(refresh).toHaveBeenCalledTimes(0);
    act(() => emit("INSERT"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("throttles a burst of 10 events to a single leading refresh", () => {
    const { client, emit } = fakeClient();
    const refresh = vi.fn();

    renderHook(() =>
      usePostgresChanges({
        channel: "test:enquiries",
        table: "enquiries",
        createClient: () => client,
        refresh,
      }),
    );

    act(() => {
      for (let i = 0; i < 10; i++) emit("INSERT");
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    // Trailing flush fires once the 250ms window closes.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("invokes onEvent per event (not throttled)", () => {
    const { client, emit } = fakeClient();
    const onEvent = vi.fn();
    const refresh = vi.fn();

    renderHook(() =>
      usePostgresChanges({
        channel: "test:enquiries",
        table: "enquiries",
        createClient: () => client,
        refresh,
        onEvent,
      }),
    );

    act(() => {
      emit("INSERT");
      emit("INSERT");
      emit("INSERT");
    });
    expect(onEvent).toHaveBeenCalledTimes(3);
    // But refresh is throttled.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("calls removeChannel on unmount", () => {
    const { client, removed } = fakeClient();
    const { unmount } = renderHook(() =>
      usePostgresChanges({
        channel: "test:enquiries",
        table: "enquiries",
        createClient: () => client,
        refresh: vi.fn(),
      }),
    );

    expect(removed.length).toBe(0);
    unmount();
    expect(removed.length).toBe(1);
  });

  it("does nothing when enabled=false", () => {
    const { client, emit } = fakeClient();
    const refresh = vi.fn();

    renderHook(() =>
      usePostgresChanges({
        channel: "test:enquiries",
        table: "enquiries",
        enabled: false,
        createClient: () => client,
        refresh,
      }),
    );

    act(() => emit("INSERT"));
    expect(refresh).toHaveBeenCalledTimes(0);
  });

  it("survives client factory throwing (e.g. missing Supabase env)", () => {
    const refresh = vi.fn();
    const createClient = () => {
      throw new Error("env not set");
    };
    expect(() =>
      renderHook(() =>
        usePostgresChanges({
          channel: "test:enquiries",
          table: "enquiries",
          createClient,
          refresh,
        }),
      ),
    ).not.toThrow();
    expect(refresh).toHaveBeenCalledTimes(0);
  });

  it("reports connected=true after SUBSCRIBED", () => {
    const { client } = fakeClient();
    const { result } = renderHook(() =>
      usePostgresChanges({
        channel: "test:enquiries",
        table: "enquiries",
        createClient: () => client,
        refresh: vi.fn(),
      }),
    );
    expect(result.current.connected).toBe(true);
  });
});
