/**
 * @vitest-environment jsdom
 *
 * The admin shell renders a desktop tree and a mobile tree and hides one with
 * CSS rather than unmounting it, so every widget in it mounts twice. Before the
 * session provider, each notification bell fetched `/api/notifications/recent`
 * for itself — four no-store requests per admin navigation, each costing two
 * round-trips to Supabase Auth, for an answer the server already had.
 *
 * These assertions are the guard on that. The count is easy to regress: it does
 * not show up in types, tests or the build, only in the network panel, and the
 * next person to add a widget to the shell has no reason to suspect it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  NotificationsBell,
  type BellNotification,
} from "@/components/brand/notifications-bell";
import { AdminSessionProvider, type AdminSession } from "./admin-session";

// The bell opens a Realtime channel on mount; stub the browser client so the
// test exercises the fetch path without a websocket.
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: () => {},
  }),
}));

const ROWS: BellNotification[] = [
  {
    id: "n1",
    kind: "new_enquiry",
    title: "Seeded from the server",
    body: null,
    link: null,
    read_at: null,
    created_at: new Date("2026-01-01T00:00:00Z").toISOString(),
  },
];

const SESSION: AdminSession = {
  userId: "user-1",
  email: "staff@bazar.ae",
  staff: { display_name: "Staff Member", title: "Advisor", role: "admin" },
  notifications: ROWS,
  unread: 1,
};

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ rows: [], unread: 0, userId: "user-1" }),
    }),
  );
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotificationsBell inside an AdminSessionProvider", () => {
  it("does not fetch — the layout already resolved the session", () => {
    render(
      <AdminSessionProvider value={SESSION}>
        <NotificationsBell />
      </AdminSessionProvider>,
    );
    expect(
      fetchSpy.mock.calls.filter((c) =>
        String(c[0]).includes("/api/notifications/recent"),
      ),
    ).toHaveLength(0);
  });

  it("still fetches nothing when the shell mounts it twice", () => {
    // The shape that made this expensive: both chrome trees render a bell.
    render(
      <AdminSessionProvider value={SESSION}>
        <NotificationsBell />
        <NotificationsBell />
      </AdminSessionProvider>,
    );
    expect(
      fetchSpy.mock.calls.filter((c) =>
        String(c[0]).includes("/api/notifications/recent"),
      ),
    ).toHaveLength(0);
  });

  it("renders the seeded unread count", async () => {
    render(
      <AdminSessionProvider value={SESSION}>
        <NotificationsBell />
      </AdminSessionProvider>,
    );
    expect(await screen.findByText("1")).toBeDefined();
  });
});

describe("NotificationsBell outside the provider", () => {
  it("keeps its self-fetch, so the component still works anywhere", () => {
    // The provider is an optimisation, not a new requirement — this is the
    // fallback path for any mount outside /admin.
    render(<NotificationsBell />);
    expect(
      fetchSpy.mock.calls.filter((c) =>
        String(c[0]).includes("/api/notifications/recent"),
      ).length,
    ).toBeGreaterThan(0);
  });
});
