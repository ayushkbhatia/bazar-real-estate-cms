/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://project-one.supabase.co" },
  isSupabaseConfigured: false,
}));

vi.mock("@/lib/queries/developments", () => ({
  listPublishedDevelopments: async () => [
    {
      id: "33333333-0000-0000-0000-000000000008",
      name: "Saadiyat Lagoons",
      slug: "saadiyat-lagoons",
      status: "on_sale",
      handover_date: "2027-11-30",
      total_units: 120,
      starting_price: 5_200_000,
      tagline: null,
      card_labels: [],
      bedrooms_text: "4-6",
      description: null,
      developer: { name: "Aldar", slug: "aldar" },
      area: { name: "Saadiyat Island", slug: "saadiyat-island" },
      hero: null,
    },
  ],
}));

vi.mock("@/lib/queries/featured-properties", () => ({
  listPropertyOptions: async () => [
    {
      id: "44444444-0000-0000-0000-00000000000B",
      reference: "BAZ-AD-01445",
      slug: "yas-riva-reserve",
      title: "Yas Riva Reserve",
      areaName: "Yas Island",
      mode: "buy",
      type: "villa",
      beds: 5,
      baths: 8,
      builtUpFt2: 5942,
      priceAed: 13_300_000,
      heroUrl: null,
    },
  ],
}));

const { areaTarget, listInternalLinkTargets } = await import("./_link-targets");
const { developmentSeedItem, propertySeedItem } = await import(
  "../_fields/record-seeds"
);

const BUCKET = "https://project-one.supabase.co/storage/v1/object/public/media";

describe("internal-link picker targets", () => {
  it("describe listings and projects exactly as the shared pickers do, plus the id", async () => {
    const targets = await listInternalLinkTargets();
    const project = targets.find((t) => t.kind === "development")!;
    const listing = targets.find((t) => t.kind === "property")!;

    const { listPublishedDevelopments } = await import(
      "@/lib/queries/developments"
    );
    const { listPropertyOptions } = await import(
      "@/lib/queries/featured-properties"
    );
    const [dev] = await listPublishedDevelopments();
    const [prop] = await listPropertyOptions();

    // The same name, href and detail the page builder's picker shows.
    expect(project).toEqual({
      ...developmentSeedItem(dev),
      kind: "development",
      id: "33333333-0000-0000-0000-000000000008",
    });
    expect(listing).toEqual({
      ...propertySeedItem(prop),
      kind: "property",
      id: "44444444-0000-0000-0000-00000000000b",
    });
    expect(listing.detail?.code).toBe("BAZ-AD-01445");
  });

  it("name a community by the area it sits in, with its parent's photograph", () => {
    const t = areaTarget({
      id: "0D4C6B8E-5A1F-4E2B-9C3D-7F8E9A0B1C2D",
      slug: "mamsha-al-saadiyat",
      name: "Mamsha Al Saadiyat",
      kind: "sub_community",
      hero: null,
      parent: {
        name: "Saadiyat Island",
        hero: { storage_key: "listings/p.jpg", deleted_at: null },
      },
    });
    expect(t).toMatchObject({
      kind: "area",
      id: "0d4c6b8e-5a1f-4e2b-9c3d-7f8e9a0b1c2d",
      name: "Mamsha Al Saadiyat",
      href: "/areas/mamsha-al-saadiyat",
      slug: "mamsha-al-saadiyat",
      detail: {
        thumb: `${BUCKET}/listings/p.jpg`,
        sub: "Community · Saadiyat Island",
      },
    });
  });

  it("show no photograph rather than a trashed one", () => {
    const t = areaTarget({
      id: "a",
      slug: "corniche",
      name: "Corniche",
      kind: "area",
      hero: { storage_key: "listings/c.jpg", deleted_at: "2026-09-01" },
      parent: { name: "Abu Dhabi", hero: null },
    });
    expect(t.detail?.thumb).toBeNull();
    expect(t.detail?.sub).toBe("Area · Abu Dhabi");
  });

  it("fall back to the slug when an area has no name", () => {
    expect(
      areaTarget({ id: "a", slug: "al-jurf", name: "  ", kind: "area" }).name,
    ).toBe("al-jurf");
  });
});
