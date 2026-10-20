/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `listRandomListings` feeds the /buy "Featured properties for sale" row.
 * Before it, that row was the four newest listings, reshuffled — the same
 * four every visit. These pin the two things that make it random: the sample
 * is drawn from every matching id, not the newest page, and the rows come
 * back in the shuffled order rather than whatever order the `in` query used.
 */

const IDS = Array.from({ length: 30 }, (_, i) => `p-${i}`);

const calls: { select: string; eq: [string, unknown][]; in?: string[] }[] = [];

function builder(select: string) {
  const call: (typeof calls)[number] = { select, eq: [] };
  calls.push(call);
  const b = {
    eq(col: string, val: unknown) {
      call.eq.push([col, val]);
      return b;
    },
    order() {
      return b;
    },
    range(from: number, to: number) {
      return Promise.resolve({
        data: IDS.slice(from, to + 1).map((id) => ({ id })),
        error: null,
      });
    },
    in(_col: string, ids: string[]) {
      call.in = ids;
      // Deliberately not the order asked for: the database's own order.
      const rows = [...ids].sort().map((id) => ({ id, property_media: [] }));
      return Promise.resolve({ data: rows, error: null });
    },
  };
  return b;
}

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/i18n/current", () => ({ currentLocale: async () => "en" }));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({
    from: () => ({ select: (s: string) => builder(s) }),
  }),
}));

import { listRandomListings } from "./curated-listings";

beforeEach(() => {
  calls.length = 0;
});

describe("listRandomListings", () => {
  it("samples from every matching id and keeps the shuffled order", async () => {
    const rows = await listRandomListings({ mode: "buy", limit: 8 });
    const [idsCall, rowsCall] = calls;

    expect(idsCall!.select).toBe("id");
    expect(idsCall!.eq).toContainEqual(["mode", "buy"]);
    expect(idsCall!.eq).toContainEqual(["status", "published"]);

    expect(rowsCall!.in).toHaveLength(8);
    expect(rows.map((r) => (r as { id: string }).id)).toEqual(rowsCall!.in);
  });

  it("draws a different sample on a different call", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const rows = await listRandomListings({ limit: 4 });
      rows.forEach((r) => seen.add((r as { id: string }).id));
    }
    // Ten draws of four from thirty: newest-first would be the same four.
    expect(seen.size).toBeGreaterThan(4);
  });
});
