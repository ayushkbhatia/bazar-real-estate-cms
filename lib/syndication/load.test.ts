import { describe, expect, it, vi } from "vitest";

const calls: [string, ...unknown[]][] = [];

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "k" },
  isSupabaseConfigured: true,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "select", "eq", "is", "range"]) {
      chain[m] = (...args: unknown[]) => {
        calls.push([m, ...args]);
        return chain;
      };
    }
    chain.then = (resolve: (r: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: [], error: null }));
    return chain;
  },
}));

const { loadFeedProperties } = await import("./load");

describe("loadFeedProperties", () => {
  it("leaves out every listing published from Salesforce", async () => {
    // Salesforce pushes its listings to Property Finder and Bayut itself.
    // Feeding them again would list each one twice on each portal.
    await loadFeedProperties();
    expect(calls).toContainEqual(["is", "salesforce_listing_id", null]);
    expect(calls).toContainEqual(["eq", "status", "published"]);
  });
});
