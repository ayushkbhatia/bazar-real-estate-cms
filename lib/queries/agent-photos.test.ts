/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";

const rows = [
  { slug: "khalid-al-zaabi", photo_url: "https://cdn.test/team/khalid.jpg" },
  { slug: "no-photo", photo_url: null },
  { slug: null, photo_url: "https://cdn.test/team/orphan.jpg" },
];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        not: () => q,
        then: (res: (v: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(res),
      };
      return q;
    },
  }),
}));

import { getAgentPhotos, withAgentPhoto, withAgentPhotos } from "./agent-photos";
import type { SeedAgent } from "@/lib/seeds/agents";

const agent = (slug: string) => ({ slug, display_name: slug }) as SeedAgent;

describe("getAgentPhotos", () => {
  it("maps slug to portrait, skipping rows that can't be joined", async () => {
    const photos = await getAgentPhotos();
    expect(photos["khalid-al-zaabi"]).toBe("https://cdn.test/team/khalid.jpg");
    // A row with no slug can't be matched to a seeded advisor.
    expect(Object.values(photos)).not.toContain(
      "https://cdn.test/team/orphan.jpg",
    );
    expect(photos["no-photo"]).toBeUndefined();
  });
});

describe("withAgentPhoto", () => {
  it("attaches the portrait when the advisor has one", async () => {
    const withPhoto = await withAgentPhoto(agent("khalid-al-zaabi"));
    expect(withPhoto?.photo_url).toBe("https://cdn.test/team/khalid.jpg");
  });

  it("sets null rather than leaving it undefined, so the card falls back", async () => {
    const withoutPhoto = await withAgentPhoto(agent("mariam-al-hashimi"));
    expect(withoutPhoto?.photo_url).toBeNull();
  });

  it("passes null through", async () => {
    expect(await withAgentPhoto(null)).toBeNull();
  });

  it("doesn't mutate the seed data", async () => {
    const original = agent("khalid-al-zaabi");
    await withAgentPhoto(original);
    // The seeds are module-level constants shared across requests — mutating
    // one would leak a portrait into every other page render.
    expect(original.photo_url).toBeUndefined();
  });
});

describe("withAgentPhotos", () => {
  it("resolves a list with a single lookup", async () => {
    const list = await withAgentPhotos([
      agent("khalid-al-zaabi"),
      agent("mariam-al-hashimi"),
    ]);
    expect(list.map((a) => a.photo_url)).toEqual([
      "https://cdn.test/team/khalid.jpg",
      null,
    ]);
  });

  it("short-circuits on an empty list", async () => {
    expect(await withAgentPhotos([])).toEqual([]);
  });
});
