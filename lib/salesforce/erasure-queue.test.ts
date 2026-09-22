import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";

const scrubLead = vi.fn();
let configured = true;

vi.mock("@/lib/env", () => ({
  get isSalesforceConfigured() {
    return configured;
  },
}));
vi.mock("./erasure", () => ({ scrubLead }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

const { drainCrmErasures } = await import("./erasure-queue");

type DueRow = { id: string; name: string; crm_external_id: string | null };

/** What the drain did to the table, in the order it did it. */
type Write = { ids: string[]; patch: Record<string, unknown> };

/**
 * A stand-in for the two query shapes the drain builds: one chained select
 * that resolves to the due rows, and update chains closed by `.in` or `.eq`.
 * Small enough to be obvious, and it keeps this spec about the drain's
 * decisions rather than about Supabase.
 */
function fakeAdmin(rows: DueRow[], selectError?: string) {
  const writes: Write[] = [];

  const selectChain = {
    not: () => selectChain,
    order: () => selectChain,
    limit: () =>
      Promise.resolve(
        selectError
          ? { data: null, error: { message: selectError } }
          : { data: rows, error: null },
      ),
  };

  const client = {
    from: () => ({
      select: () => selectChain,
      update: (patch: Record<string, unknown>) => ({
        in: (_col: string, ids: string[]) => {
          writes.push({ ids, patch });
          return Promise.resolve({ error: null });
        },
        eq: (_col: string, id: string) => {
          writes.push({ ids: [id], patch });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  } as unknown as SupabaseClient<Database>;

  return { client, writes };
}

/** Every id the drain retired, i.e. cleared the marker on. */
function cleared(writes: Write[]): string[] {
  return writes
    .filter((w) => w.patch.crm_erasure_due_at === null)
    .flatMap((w) => w.ids);
}

beforeEach(() => {
  scrubLead.mockReset();
  configured = true;
});

describe("drainCrmErasures", () => {
  it("does nothing when nothing is due", async () => {
    const { client, writes } = fakeAdmin([]);
    const out = await drainCrmErasures(client);
    expect(out).toEqual({
      scrubbed: 0,
      remaining: 0,
      cleared: 0,
      lastError: null,
    });
    expect(writes).toHaveLength(0);
    expect(scrubLead).not.toHaveBeenCalled();
  });

  it("scrubs each record with the pseudonym already on its row", async () => {
    // Not a fresh pseudonym: migration 0067 wrote one into Postgres, and the
    // two systems have to name the same subject the same way.
    scrubLead.mockResolvedValue({ ok: true });
    const { client, writes } = fakeAdmin([
      { id: "e1", name: "deleted-aaa", crm_external_id: "a04A" },
      { id: "e2", name: "deleted-aaa", crm_external_id: "a04B" },
    ]);

    const out = await drainCrmErasures(client);

    expect(scrubLead).toHaveBeenCalledWith("a04A", "deleted-aaa");
    expect(scrubLead).toHaveBeenCalledWith("a04B", "deleted-aaa");
    expect(out.scrubbed).toBe(2);
    expect(cleared(writes).sort()).toEqual(["e1", "e2"]);
  });

  it("retires a row that never reached the CRM without spending a call", async () => {
    const { client, writes } = fakeAdmin([
      { id: "e1", name: "deleted-aaa", crm_external_id: null },
    ]);
    const out = await drainCrmErasures(client);
    expect(scrubLead).not.toHaveBeenCalled();
    expect(out).toMatchObject({ cleared: 1, scrubbed: 0, remaining: 0 });
    expect(cleared(writes)).toEqual(["e1"]);
  });

  it("keeps the marker when the scrub fails", async () => {
    // The whole point of the column: an unfinished erasure has to stay
    // visible rather than evaporating with the request that raised it.
    scrubLead.mockResolvedValue({
      ok: false,
      retryable: true,
      message: "SERVER_UNAVAILABLE: try later",
    });
    const { client, writes } = fakeAdmin([
      { id: "e1", name: "deleted-aaa", crm_external_id: "a04A" },
    ]);

    const out = await drainCrmErasures(client);

    expect(out).toMatchObject({ scrubbed: 0, remaining: 1 });
    expect(out.lastError).toContain("SERVER_UNAVAILABLE");
    expect(cleared(writes)).toEqual([]);
  });

  it("finishes the batch after one record fails", async () => {
    scrubLead
      .mockResolvedValueOnce({ ok: false, retryable: true, message: "boom" })
      .mockResolvedValueOnce({ ok: true });
    const { client, writes } = fakeAdmin([
      { id: "e1", name: "deleted-aaa", crm_external_id: "a04A" },
      { id: "e2", name: "deleted-bbb", crm_external_id: "a04B" },
    ]);

    const out = await drainCrmErasures(client);

    expect(out).toMatchObject({ scrubbed: 1, remaining: 1 });
    expect(cleared(writes)).toEqual(["e2"]);
  });

  it("leaves the obligation standing when Salesforce is not configured", async () => {
    configured = false;
    const { client, writes } = fakeAdmin([
      { id: "e1", name: "deleted-aaa", crm_external_id: "a04A" },
    ]);

    const out = await drainCrmErasures(client);

    expect(scrubLead).not.toHaveBeenCalled();
    expect(out).toMatchObject({ remaining: 1, scrubbed: 0 });
    expect(out.lastError).toBe("Salesforce is not configured");
    expect(cleared(writes)).toEqual([]);
  });

  it("reports a read failure instead of throwing into the erasure action", async () => {
    const { client } = fakeAdmin([], "connection reset");
    const out = await drainCrmErasures(client);
    expect(out.lastError).toBe("connection reset");
    expect(out.scrubbed).toBe(0);
  });
});
