/**
 * @vitest-environment node
 *
 * `logAudit()` writes the id it is given as it is given — a row's uuid or the
 * key a singleton, form or data subject is known by — and a write that fails
 * is reported under source "audit", never dropped in silence. The column
 * accepting those ids is migration 0153; lib/audit.db.test.ts proves that half
 * against the local stack.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reportErrorMock, state } = vi.hoisted(() => ({
  reportErrorMock: vi.fn(async () => {}),
  state: {
    user: { id: "7d0c3a52-1f1e-4b8e-9a8a-2b6f0c1d4e5f" } as { id: string } | null,
    inserts: [] as Record<string, unknown>[],
    /** What the insert resolves to, or throws when an Error. */
    result: { error: null } as { error: unknown } | Error,
  },
}));

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/observability", () => ({ reportError: reportErrorMock }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from(table: string) {
      expect(table).toBe("audit_log");
      return {
        async insert(row: Record<string, unknown>) {
          state.inserts.push(row);
          if (state.result instanceof Error) throw state.result;
          return state.result;
        },
      };
    },
  }),
}));

import { logAudit } from "./audit";

beforeEach(() => {
  reportErrorMock.mockClear();
  state.user = { id: "7d0c3a52-1f1e-4b8e-9a8a-2b6f0c1d4e5f" };
  state.inserts = [];
  state.result = { error: null };
});

describe("logAudit", () => {
  // Real ids from the call sites, uuid and not. Before 0153 every one but the
  // uuid failed the insert.
  it.each([
    ["a row's uuid", "property", "3f2b8c1e-9d4a-4e6b-8f0a-1c2d3e4f5a6b"],
    ["the site-settings singleton", "site_settings", "1"],
    ["the Salesforce sync settings", "salesforce_listing_sync", "settings"],
    ["the floating-CTA rail", "floating_ctas", "rail"],
    ["a data subject", "data_subject", "subject@example.com"],
    ["a Salesforce listing", "salesforce_listing", "a0X5g00000AbCdEFGH"],
    ["a Salesforce mapping", "salesforce_mapping", "community:al reem island"],
    ["a mortgage holiday", "mortgage_holidays", "2026-12-02"],
  ])("writes %s's id verbatim", async (_label, target_kind, target_id) => {
    await logAudit({ action: "test.action", target_kind, target_id, after: { ok: true } });

    expect(state.inserts).toEqual([
      {
        actor_id: "7d0c3a52-1f1e-4b8e-9a8a-2b6f0c1d4e5f",
        actor_kind: "user",
        action: "test.action",
        target_kind,
        target_id,
        before: null,
        after: { ok: true },
      },
    ]);
    expect(reportErrorMock).not.toHaveBeenCalled();
  });

  it("writes no target when there is none", async () => {
    await logAudit({ action: "staff.invite", target_kind: "staff_invitation", target_id: null });
    expect(state.inserts[0]).toMatchObject({ target_id: null });
  });

  it("reports a refused insert under source \"audit\" and lets the caller carry on", async () => {
    const refused = {
      code: "22P02",
      message: 'invalid input syntax for type uuid: "settings"',
      details: null,
      hint: null,
    };
    state.result = { error: refused };

    await expect(
      logAudit({
        action: "salesforce.listing_sync_settings",
        target_kind: "salesforce_listing_sync",
        target_id: "settings",
      }),
    ).resolves.toBeUndefined();

    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(reportErrorMock).toHaveBeenCalledWith(refused, {
      source: "audit",
      context: {
        audit: {
          action: "salesforce.listing_sync_settings",
          target_kind: "salesforce_listing_sync",
          target_id: "settings",
        },
      },
    });
  });

  it("reports a thrown write under source \"audit\" too", async () => {
    const boom = new Error("fetch failed");
    state.result = boom;

    await expect(
      logAudit({ action: "settings.brand_update", target_kind: "site_settings", target_id: "1" }),
    ).resolves.toBeUndefined();

    expect(reportErrorMock).toHaveBeenCalledWith(boom, {
      source: "audit",
      context: { audit: { action: "settings.brand_update", target_kind: "site_settings", target_id: "1" } },
    });
  });

  it("writes nothing without a signed-in user", async () => {
    state.user = null;
    await logAudit({ action: "settings.brand_update", target_kind: "site_settings", target_id: "1" });
    expect(state.inserts).toEqual([]);
    expect(reportErrorMock).not.toHaveBeenCalled();
  });
});
