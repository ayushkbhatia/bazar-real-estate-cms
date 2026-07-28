/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: false, env: {} }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    throw new Error("not used in these tests");
  },
}));

import { buildMediaUsageIndex, collectMediaIds } from "./media-usage";

describe("collectMediaIds", () => {
  it("finds media ids at any depth of a page's blocks", () => {
    const blocks = [
      { type: "hero", image: { media_id: "a" } },
      { type: "split", image: null, nested: [{ image: { media_id: "b" } }] },
      { type: "text", body: "no images here" },
    ];
    expect(collectMediaIds(blocks).sort()).toEqual(["a", "b"]);
  });

  it("de-duplicates and ignores empty or non-string values", () => {
    const blocks = [
      { image: { media_id: "a" } },
      { image: { media_id: "a" } },
      { image: { media_id: "" } },
      { image: { media_id: null } },
      { image: { media_id: 42 } },
    ];
    expect(collectMediaIds(blocks)).toEqual(["a"]);
  });

  it("survives junk", () => {
    expect(collectMediaIds(null)).toEqual([]);
    expect(collectMediaIds("string")).toEqual([]);
    expect(collectMediaIds({})).toEqual([]);
  });
});

describe("buildMediaUsageIndex", () => {
  it("returns a complete empty index when there is nothing to look up", async () => {
    const index = await buildMediaUsageIndex([]);
    expect(index.byAsset.size).toBe(0);
    expect(index.partial).toBe(false);
  });

  it("is not marked partial when Supabase isn't configured", async () => {
    // Local/preview without credentials: no sources ran, but the page must
    // still render. Nothing is deletable there anyway — every asset reads as
    // unused and the environment has no storage to clean up.
    const index = await buildMediaUsageIndex([
      { id: "m-1", storage_key: "listings/m-1.jpg" },
    ]);
    expect(index.failedSources).toEqual([]);
    expect(index.partial).toBe(false);
  });
});
