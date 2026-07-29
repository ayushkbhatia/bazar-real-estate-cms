import { describe, it, expect } from "vitest";
import {
  areaCreateSchema,
  areaEditSchema,
  normaliseAreaInput,
  parentError,
} from "./area";

describe("areaCreateSchema", () => {
  const valid = {
    name: "Saadiyat Island",
    slug: "saadiyat-island",
    kind: "area" as const,
    parent_id: null,
  };

  it("accepts a well-formed area", () => {
    expect(areaCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects slugs that wouldn't survive as a URL", () => {
    for (const slug of ["Saadiyat Island", "saadiyat_island", "-leading", "trailing-"]) {
      const res = areaCreateSchema.safeParse({ ...valid, slug });
      expect(res.success, slug).toBe(false);
    }
  });

  it("rejects an unknown kind", () => {
    expect(
      areaCreateSchema.safeParse({ ...valid, kind: "district" }).success,
    ).toBe(false);
  });

  it("treats a blank parent as top-level rather than an invalid uuid", () => {
    const res = areaCreateSchema.safeParse({
      ...valid,
      parent_id: normaliseAreaInput({ parent_id: "" }).parent_id,
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.parent_id).toBeNull();
  });
});

describe("normaliseAreaInput", () => {
  it("blanks become null and coordinates become numbers", () => {
    const out = normaliseAreaInput({
      name: "  Yas Island  ",
      slug: " yas-island ",
      description: "",
      meta_title: "",
      lat: "24.4959",
      lng: "",
    });
    expect(out.name).toBe("Yas Island");
    expect(out.slug).toBe("yas-island");
    expect(out.description).toBeNull();
    expect(out.meta_title).toBeNull();
    expect(out.lat).toBe(24.4959);
    expect(out.lng).toBeNull();
  });

  it("keeps a nonsense coordinate out of the row", () => {
    expect(normaliseAreaInput({ lat: "not-a-number" }).lat).toBeNull();
  });
});

describe("areaEditSchema", () => {
  it("rejects coordinates outside the globe", () => {
    const base = {
      name: "Yas Island",
      slug: "yas-island",
      kind: "area" as const,
      parent_id: null,
    };
    expect(areaEditSchema.safeParse({ ...base, lat: 91 }).success).toBe(false);
    expect(areaEditSchema.safeParse({ ...base, lng: -181 }).success).toBe(false);
    expect(
      areaEditSchema.safeParse({ ...base, lat: 24.5, lng: 54.4 }).success,
    ).toBe(true);
  });
});

describe("parentError", () => {
  it("allows a narrower area inside a broader one", () => {
    expect(
      parentError({
        kind: "sub_community",
        parentId: "p",
        parentKind: "area",
      }),
    ).toBeNull();
  });

  it("refuses a parent at the same level or narrower", () => {
    // An area can't sit inside another area, and certainly not inside a
    // building — the hierarchy would be nonsense and the guide's breadcrumbs
    // would loop.
    expect(
      parentError({ kind: "area", parentId: "p", parentKind: "area" }),
    ).toMatch(/broader/i);
    expect(
      parentError({ kind: "area", parentId: "p", parentKind: "building" }),
    ).toMatch(/broader/i);
  });

  it("refuses an area as its own parent", () => {
    expect(
      parentError({
        id: "same",
        kind: "area",
        parentId: "same",
        parentKind: "emirate",
      }),
    ).toMatch(/its own parent/i);
  });

  it("is silent when there's no parent", () => {
    expect(
      parentError({ kind: "area", parentId: null, parentKind: null }),
    ).toBeNull();
  });
});
