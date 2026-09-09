/**
 * @vitest-environment node
 *
 * `amenities_taxonomy.label_ar` has existed since migration 0104 and, until
 * this action, no screen in the CMS could write to an existing row — the only
 * Arabic input was on the *add* form, so the twenty-one entries seeded in code
 * had Arabic and the eighty-seven the client actually uses could not be given
 * any. These cover the write that closes that.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AmenityTaxonomyEntry } from "@/lib/schemas/amenity-taxonomy";

const { setSpy, auditSpy, taxonomy } = vi.hoisted(() => ({
  setSpy: vi.fn(async () => true),
  auditSpy: vi.fn(async () => undefined),
  taxonomy: { rows: [] as AmenityTaxonomyEntry[] },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => undefined) }));
vi.mock("@/lib/audit", () => ({ logAudit: auditSpy }));
vi.mock("@/lib/queries/amenities-taxonomy", () => ({
  listAmenitiesTaxonomyForAdmin: vi.fn(async () => taxonomy.rows),
  upsertAmenityTaxonomyEntry: vi.fn(async () => true),
  setAmenityLabelAr: setSpy,
}));

const { setAmenityArabic } = await import("./_actions");

beforeEach(() => {
  setSpy.mockClear();
  auditSpy.mockClear();
  taxonomy.rows = [
    {
      code: "sea_vieww",
      label: "Sea View",
      label_ar: null,
      category: "view",
      icon: null,
      sort_order: 0,
      active: true,
    },
  ];
});

describe("setAmenityArabic", () => {
  it("writes the twin and collapses the whitespace around it", async () => {
    const res = await setAmenityArabic("sea_vieww", "  إطلالة  على البحر ");
    expect(res.status).toBe("ok");
    expect(setSpy).toHaveBeenCalledWith("sea_vieww", "إطلالة على البحر");
  });

  it("stores NULL for a cleared box, not an empty string", async () => {
    // `localiseRow` and `amenityLabel` both read "" as "no Arabic". Writing
    // NULL means the three of them cannot disagree about whitespace.
    const res = await setAmenityArabic("sea_vieww", "   ");
    expect(res.status).toBe("ok");
    expect(setSpy).toHaveBeenCalledWith("sea_vieww", null);
  });

  it("refuses a value past the column's cap without touching the row", async () => {
    const res = await setAmenityArabic("sea_vieww", "ط".repeat(91));
    expect(res.status).toBe("error");
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("refuses a code that is not in the taxonomy", async () => {
    const res = await setAmenityArabic("no_such_code", "شيء");
    expect(res.status).toBe("error");
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("records what the twin was, so an overwrite is recoverable", async () => {
    taxonomy.rows[0].label_ar = "إطلالة بحرية";
    await setAmenityArabic("sea_vieww", "إطلالة على البحر");
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "amenity_taxonomy.set_label_ar",
        before: { code: "sea_vieww", label_ar: "إطلالة بحرية" },
        after: { code: "sea_vieww", label_ar: "إطلالة على البحر" },
      }),
    );
  });
});
