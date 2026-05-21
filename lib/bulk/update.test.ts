import { describe, expect, it, vi } from "vitest";
import { applyBulkUpdate } from "./update";
import type { BulkUpdateClient } from "./update";

const ID_A = "id-aaaa-aaaa-1111";
const ID_B = "id-bbbb-bbbb-2222";
const ID_C = "id-cccc-cccc-3333";
const AGENT_X = "11111111-1111-4111-8111-111111111111";
const AGENT_Y = "22222222-2222-4222-8222-222222222222";

type Row = {
  id: string;
  status: string;
  assigned_agent_id: string | null;
  mode: string;
};

/**
 * Build a mock Supabase client that respects a per-id visibility filter
 * (simulating RLS). Rows in `visibleIds` are returned by SELECT and
 * mutated by UPDATE; rows outside that set are silently skipped, exactly
 * like RLS does on the real DB.
 */
function makeMockClient(opts: {
  rows: Row[];
  visibleIds: Set<string>;
  /** Hard error injected on the SELECT call (e.g. network). */
  selectError?: string;
  /** Hard error injected on the UPDATE call. */
  updateError?: string;
  /** Simulate "user can read but can't write": rows that disappear from
   *  UPDATE but were present in SELECT. */
  notWritable?: Set<string>;
}): BulkUpdateClient {
  const visible = opts.visibleIds;
  const rowByid = new Map(opts.rows.map((r) => [r.id, r]));

  return {
    from: () => {
      const select = (_cols: string) => {
        const requestedIds: string[] = [];
        const stage = {
          in: (_col: string, ids: string[]) => {
            requestedIds.push(...ids);
            return stage;
          },
          is: (_col: string, _value: null) => stage,
          then: <T>(
            onFulfilled: (r: {
              data: Row[] | null;
              error: { message: string } | null;
            }) => T,
          ): Promise<T> => {
            if (opts.selectError) {
              return Promise.resolve(
                onFulfilled({
                  data: null,
                  error: { message: opts.selectError },
                }),
              );
            }
            const data = requestedIds
              .filter((id) => visible.has(id))
              .map((id) => rowByid.get(id))
              .filter((r): r is Row => Boolean(r));
            return Promise.resolve(onFulfilled({ data, error: null }));
          },
        };
        return stage as unknown as never;
      };

      const update = (patch: Record<string, unknown>) => {
        const requestedIds: string[] = [];
        const stage = {
          in: (_col: string, ids: string[]) => {
            requestedIds.push(...ids);
            return stage;
          },
          is: (_col: string, _value: null) => stage,
          select: (_cols: string) => ({
            then: <T>(
              onFulfilled: (r: {
                data: Row[] | null;
                error: { message: string } | null;
              }) => T,
            ): Promise<T> => {
              if (opts.updateError) {
                return Promise.resolve(
                  onFulfilled({
                    data: null,
                    error: { message: opts.updateError },
                  }),
                );
              }
              const data: Row[] = [];
              for (const id of requestedIds) {
                if (!visible.has(id)) continue;
                if (opts.notWritable?.has(id)) continue;
                const before = rowByid.get(id);
                if (!before) continue;
                const after: Row = { ...before, ...patch } as Row;
                // Persist so a follow-up SELECT sees the new state.
                rowByid.set(id, after);
                data.push(after);
              }
              return Promise.resolve(onFulfilled({ data, error: null }));
            },
          }),
        };
        return stage as unknown as never;
      };

      return { select, update };
    },
  } as unknown as BulkUpdateClient;
}

describe("applyBulkUpdate — RLS-skip simulator", () => {
  it("returns 'error' on invalid input (empty ids)", async () => {
    const client = makeMockClient({ rows: [], visibleIds: new Set() });
    const audit = vi.fn();
    const result = await applyBulkUpdate(
      client,
      { ids: [], patch: { status: "published" } },
      audit,
    );
    expect(result.status).toBe("error");
    expect(audit).not.toHaveBeenCalled();
  });

  it("marks invisible ids as 'not_visible' and skips them", async () => {
    const rows: Row[] = [
      { id: ID_A, status: "draft", assigned_agent_id: null, mode: "buy" },
      { id: ID_B, status: "draft", assigned_agent_id: null, mode: "buy" },
    ];
    const client = makeMockClient({
      rows,
      // Only ID_A is visible. ID_B is hidden by RLS.
      visibleIds: new Set([ID_A]),
    });
    const audit = vi.fn().mockResolvedValue(undefined);
    const result = await applyBulkUpdate(
      client,
      { ids: [ID_A, ID_B], patch: { status: "off_market" } },
      audit,
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.succeeded).toEqual([ID_A]);
    expect(result.skipped).toEqual([
      { id: ID_B, reason: "not_visible" },
    ]);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it("returns all-skipped when nothing is visible", async () => {
    const client = makeMockClient({
      rows: [],
      visibleIds: new Set(),
    });
    const audit = vi.fn().mockResolvedValue(undefined);
    const result = await applyBulkUpdate(
      client,
      { ids: [ID_A, ID_B, ID_C], patch: { status: "off_market" } },
      audit,
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.succeeded).toEqual([]);
    expect(result.skipped.map((s) => s.id).sort()).toEqual(
      [ID_A, ID_B, ID_C].sort(),
    );
    expect(result.skipped.every((s) => s.reason === "not_visible")).toBe(true);
    expect(audit).not.toHaveBeenCalled();
  });

  it("logs one audit row per succeeded id with before/after deltas", async () => {
    const rows: Row[] = [
      { id: ID_A, status: "draft", assigned_agent_id: null, mode: "buy" },
      { id: ID_B, status: "draft", assigned_agent_id: null, mode: "buy" },
    ];
    const client = makeMockClient({
      rows,
      visibleIds: new Set([ID_A, ID_B]),
    });
    const audit = vi.fn().mockResolvedValue(undefined);
    await applyBulkUpdate(
      client,
      { ids: [ID_A, ID_B], patch: { assigned_agent_id: AGENT_X } },
      audit,
    );
    expect(audit).toHaveBeenCalledTimes(2);
    const calls = audit.mock.calls.map((c) => c[0]);
    for (const call of calls) {
      expect(call.action).toBe("property.bulk_update");
      expect(call.target_kind).toBe("property");
      // before/after should reference only the patched key.
      expect(call.before).toEqual({ assigned_agent_id: null });
      expect(call.after).toEqual({ assigned_agent_id: AGENT_X });
    }
  });

  it("surfaces a 'not_writable' subset as skipped error rows", async () => {
    const rows: Row[] = [
      { id: ID_A, status: "draft", assigned_agent_id: null, mode: "buy" },
      { id: ID_B, status: "draft", assigned_agent_id: null, mode: "buy" },
    ];
    const client = makeMockClient({
      rows,
      visibleIds: new Set([ID_A, ID_B]),
      // ID_B reads but doesn't write (e.g. agent role with restricted UPDATE policy).
      notWritable: new Set([ID_B]),
    });
    const audit = vi.fn().mockResolvedValue(undefined);
    const result = await applyBulkUpdate(
      client,
      { ids: [ID_A, ID_B], patch: { status: "off_market" } },
      audit,
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.succeeded).toEqual([ID_A]);
    expect(result.skipped).toEqual([
      { id: ID_B, reason: "error", detail: "update returned no row" },
    ]);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it("bails with status='error' on a SELECT failure", async () => {
    const client = makeMockClient({
      rows: [],
      visibleIds: new Set(),
      selectError: "transient db error",
    });
    const audit = vi.fn();
    const result = await applyBulkUpdate(
      client,
      { ids: [ID_A], patch: { status: "off_market" } },
      audit,
    );
    expect(result.status).toBe("error");
    if (result.status !== "error") throw new Error("unreachable");
    expect(result.message).toBe("transient db error");
    expect(audit).not.toHaveBeenCalled();
  });

  it("bails with status='error' on UPDATE failure (no audit writes)", async () => {
    const rows: Row[] = [
      { id: ID_A, status: "draft", assigned_agent_id: null, mode: "buy" },
    ];
    const client = makeMockClient({
      rows,
      visibleIds: new Set([ID_A]),
      updateError: "permission denied",
    });
    const audit = vi.fn();
    const result = await applyBulkUpdate(
      client,
      { ids: [ID_A], patch: { status: "off_market" } },
      audit,
    );
    expect(result.status).toBe("error");
    expect(audit).not.toHaveBeenCalled();
  });

  it("handles reassign-to-null as a normal patch", async () => {
    const rows: Row[] = [
      { id: ID_A, status: "draft", assigned_agent_id: AGENT_Y, mode: "buy" },
    ];
    const client = makeMockClient({
      rows,
      visibleIds: new Set([ID_A]),
    });
    const audit = vi.fn().mockResolvedValue(undefined);
    const result = await applyBulkUpdate(
      client,
      { ids: [ID_A], patch: { assigned_agent_id: null } },
      audit,
    );
    expect(result.status).toBe("ok");
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0].before).toEqual({
      assigned_agent_id: AGENT_Y,
    });
    expect(audit.mock.calls[0][0].after).toEqual({ assigned_agent_id: null });
  });
});
