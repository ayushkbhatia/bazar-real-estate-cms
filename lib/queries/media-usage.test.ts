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

  it("finds images inside a master-page section document", () => {
    // Master pages store their sections in `pages.blocks` too, with images
    // nested inside list items — those must count as usages, or the media
    // library would offer a live home-page card image for deletion.
    const blocks = [
      {
        key: "location_browsing",
        enabled: true,
        values: {
          overview_image: { media_id: "overview" },
          cards: [
            { enabled: true, image: { media_id: "yas" } },
            { enabled: false, image: { media_id: "reem" } },
          ],
        },
      },
    ];
    expect(collectMediaIds(blocks).sort()).toEqual(["overview", "reem", "yas"]);
  });

  it("survives junk", () => {
    expect(collectMediaIds(null)).toEqual([]);
    expect(collectMediaIds("string")).toEqual([]);
    expect(collectMediaIds({})).toEqual([]);
  });
});

describe("advisor portraits", () => {
  it("is a usage kind, so a headshot in use is protected", async () => {
    const { deriveMediaState, canTrash } = await import("../media-usage");
    const portrait = {
      kind: "advisor" as const,
      id: "u-1",
      label: "Mariam",
      role: "Portrait",
      href: "/admin/agents/u-1",
      live: true,
      internal: false,
    };
    // staff.photo_url holds a URL rather than a media id, so the index matches
    // on storage key — without it the library would offer a live headshot for
    // deletion.
    expect(deriveMediaState([portrait])).toBe("live");
    expect(canTrash({ state: "live", indexPartial: false }).allowed).toBe(
      false,
    );
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
