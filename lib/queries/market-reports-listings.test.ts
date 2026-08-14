/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROW = {
  id: "p-1",
  reference: "BAZ-AD-08114",
  slug: "villa-saadiyat-08114",
  title: "Four-bed villa on Saadiyat",
  price_aed: 9_200_000,
  beds: 4,
  baths: 5,
  built_up_ft2: 4200,
  areas: { name: "Saadiyat Island", slug: "saadiyat-island" },
  property_media: [
    {
      role: "gallery",
      media: { storage_key: "listings/b.jpg", alt_text: "Pool" },
    },
    {
      role: "hero",
      media: { storage_key: "listings/a.jpg", alt_text: "Front elevation" },
    },
  ],
};

let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: true,
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://db.test" },
}));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      const chain = new Proxy(q, {
        get(_t, prop: string) {
          if (prop === "then")
            return (res: (v: unknown) => unknown) =>
              Promise.resolve(
                table === "areas"
                  ? { data: { id: "area-1" }, error: null }
                  : nextResult,
              ).then(res);
          return () => chain;
        },
      });
      return chain;
    },
  }),
}));

import { listLiveComparables } from "./market-reports-listings";

/**
 * The comparables rail on every market report has been returning nothing.
 *
 * `properties` has no `hero_image_id` column, so `hero:hero_image_id(...)` was
 * an embed against a foreign key that does not exist. PostgREST rejects the
 * whole select — verified live against production:
 *
 *   status=400  PGRST200
 *   "Could not find a relationship between 'properties' and 'hero_image_id'"
 *
 * and the function read only `{ data }`, so a hard 400 looked exactly like an
 * area with no matching listings. Nothing surfaced, nothing logged, nothing
 * failed.
 */
describe("listLiveComparables select", () => {
  it("does not embed a foreign key that properties does not have", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/queries/market-reports-listings.ts"),
      "utf8",
    );
    // Asserted on the source rather than through the mock, because a mock
    // answers whatever it is asked — only the real schema can reject this, and
    // this is the cheapest stand-in for the schema.
    expect(src).not.toContain("hero:hero_image_id");
    expect(src).toContain("property_media(role, media:media_assets(");
  });

  it("matches the column list db/types.ts actually declares for properties", () => {
    const types = readFileSync(join(process.cwd(), "db/types.ts"), "utf8");
    const start = types.indexOf("      properties: {");
    const block = types.slice(start, types.indexOf("Insert:", start));
    expect(start).toBeGreaterThan(-1);
    expect(block).not.toContain("hero_image_id");
  });
});

describe("listLiveComparables", () => {
  it("picks the hero out of property_media rather than a hero column", async () => {
    nextResult = { data: [ROW], error: null };
    const rows = await listLiveComparables({
      area_slug: "saadiyat-island",
      property_type: "villa",
    });
    expect(rows).toHaveLength(1);
    // The hero is the role='hero' row, not simply the first one — the fixture
    // deliberately puts a gallery image ahead of it.
    expect(rows[0]!.hero_url).toContain("listings/a.jpg");
    expect(rows[0]!.hero_alt).toBe("Front elevation");
    expect(rows[0]!.area_name).toBe("Saadiyat Island");
  });

  it("survives a listing with no media at all", async () => {
    nextResult = { data: [{ ...ROW, property_media: null }], error: null };
    const rows = await listLiveComparables({
      area_slug: "saadiyat-island",
      property_type: "villa",
    });
    expect(rows[0]!.hero_url).toBeNull();
    expect(rows[0]!.hero_alt).toBeNull();
  });

  it("logs a PostgREST error instead of returning it as an empty result", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    nextResult = { data: null, error: { code: "PGRST200", message: "boom" } };
    const rows = await listLiveComparables({
      area_slug: "saadiyat-island",
      property_type: "villa",
    });
    expect(rows).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
