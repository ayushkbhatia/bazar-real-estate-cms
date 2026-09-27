/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://project-one.supabase.co" },
  isSupabaseConfigured: true,
}));

const { areaTarget, developmentTarget, propertyTarget } = await import(
  "./targets"
);

const BUCKET = "https://project-one.supabase.co/storage/v1/object/public/media";

describe("picker targets", () => {
  it("name an area and say what it sits in", () => {
    expect(
      areaTarget({
        id: "0D4C6B8E-5A1F-4E2B-9C3D-7F8E9A0B1C2D",
        slug: "mamsha-al-saadiyat",
        name: "Mamsha Al Saadiyat",
        kind: "sub_community",
        parent: { name: "Saadiyat Island" },
        hero: null,
      }),
    ).toEqual({
      kind: "area",
      id: "0d4c6b8e-5a1f-4e2b-9c3d-7f8e9a0b1c2d",
      name: "Mamsha Al Saadiyat",
      detail: "Sub-community · Saadiyat Island",
      href: "/areas/mamsha-al-saadiyat",
      thumb: null,
    });
  });

  it("name a project by developer and area", () => {
    const t = developmentTarget({
      id: "33333333-0000-0000-0000-000000000008",
      slug: "saadiyat-lagoons",
      name: "Saadiyat Lagoons",
      developers: { name: "Aldar" },
      areas: { name: "Saadiyat Island" },
      hero: { storage_key: "listings/l.jpg", deleted_at: null },
    });
    expect(t.detail).toBe("Aldar · Saadiyat Island");
    expect(t.href).toBe("/developments/saadiyat-lagoons");
    expect(t.thumb).toBe(`${BUCKET}/listings/l.jpg`);
  });

  it("make a listing findable by its reference", () => {
    const t = propertyTarget({
      id: "44444444-0000-0000-0000-000000000001",
      reference: "BAZ-AD-04891",
      slug: "sea-view-villa",
      title: "Sea-view villa",
      price_aed: 12_500_000,
      areas: { name: "Saadiyat Island" },
      property_media: [
        { role: "gallery", media: { storage_key: "listings/g.jpg" } },
        { role: "hero", media: { storage_key: "listings/h.jpg" } },
      ],
    });
    expect(t.detail).toBe("BAZ-AD-04891 · Saadiyat Island · AED 12.5M");
    expect(t.href).toBe("/p/sea-view-villa-baz-ad-04891");
    expect(t.thumb).toBe(`${BUCKET}/listings/h.jpg`);
  });

  it("show no thumbnail for a trashed photograph", () => {
    const t = developmentTarget({
      id: "33333333-0000-0000-0000-000000000008",
      slug: "x",
      name: "X",
      hero: { storage_key: "listings/l.jpg", deleted_at: "2026-09-01" },
    });
    expect(t.thumb).toBeNull();
  });

  it("fall back to the slug or reference when a name is blank", () => {
    expect(
      areaTarget({ id: "a", slug: "corniche", name: "  ", kind: "area" }).name,
    ).toBe("corniche");
    expect(
      propertyTarget({
        id: "p",
        reference: "BAZ-AD-1",
        slug: "s",
        title: null,
        price_aed: 0,
      }),
    ).toMatchObject({ name: "BAZ-AD-1", detail: "BAZ-AD-1" });
  });
});
