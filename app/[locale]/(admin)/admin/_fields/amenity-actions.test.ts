/**
 * @vitest-environment node
 *
 * The picker used to write free text onto one listing. That value printed on
 * the property page, was not a search filter, and — the reason this action
 * exists — had nowhere to hold Arabic, because an amenity's Arabic lives on
 * `amenities_taxonomy.label_ar` and nowhere else. Fifty-five such values are
 * in the live catalogue, each a word that renders English on /ar for ever.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AmenityTaxonomyEntry } from "@/lib/schemas/amenity-taxonomy";

const { upsertSpy, taxonomy } = vi.hoisted(() => ({
  upsertSpy: vi.fn(async () => true),
  taxonomy: { rows: [] as AmenityTaxonomyEntry[] },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => undefined) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => undefined) }));
vi.mock("@/lib/queries/amenities-taxonomy", () => ({
  listAmenitiesTaxonomyForAdmin: vi.fn(async () => taxonomy.rows),
  upsertAmenityTaxonomyEntry: upsertSpy,
}));

const { addAmenityToTaxonomy } = await import("./amenity-actions");

function entry(
  code: string,
  label: string,
  over: Partial<AmenityTaxonomyEntry> = {},
): AmenityTaxonomyEntry {
  return {
    code,
    label,
    label_ar: null,
    category: "outdoor",
    icon: null,
    sort_order: 10,
    active: true,
    ...over,
  };
}

beforeEach(() => {
  upsertSpy.mockClear();
  taxonomy.rows = [entry("pool", "Pool"), entry("security", "24/7 Security")];
});

describe("addAmenityToTaxonomy", () => {
  it("writes the row with the category and Arabic the lister chose", async () => {
    const res = await addAmenityToTaxonomy({
      label: "  Rooftop   cinema ",
      label_ar: " سينما على السطح ",
      category: "outdoor",
    });
    expect(res.status).toBe("created");
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "rooftop_cinema",
        label: "Rooftop cinema",
        label_ar: "سينما على السطح",
        category: "outdoor",
        active: true,
      }),
    );
    if (res.status !== "created") return;
    expect(res.option.label).toBe("Rooftop cinema");
  });

  it("selects the existing entry rather than adding a second spelling", async () => {
    // Migration 0106's rule, checked before the write: one *selectable*
    // amenity per label. A fresh code does not resolve a label collision.
    const res = await addAmenityToTaxonomy({ label: "  pool " });
    expect(res.status).toBe("exists");
    expect(upsertSpy).not.toHaveBeenCalled();
    if (res.status !== "exists") return;
    expect(res.option.code).toBe("pool");
  });

  it("suffixes a code another row already holds", async () => {
    // "24/7 Security" and "Security gate" both derive `security`, and that is
    // not a collision an agent can do anything about. The label is what
    // anybody reads; the code only has to be unique.
    const res = await addAmenityToTaxonomy({ label: "Security gate" });
    expect(res.status).toBe("created");
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ code: "security_gate" }),
    );

    upsertSpy.mockClear();
    taxonomy.rows.push(entry("security_gate", "Security gate"));
    const clash = await addAmenityToTaxonomy({ label: "Security-gate" });
    expect(clash.status).toBe("created");
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ code: "security_gate_2" }),
    );
  });

  it("still writes a row for a label with no Latin in it", async () => {
    // An amenity typed in Arabic has no derivable code. Blocking the write
    // would put back the wait the free-text escape hatch existed to remove.
    const res = await addAmenityToTaxonomy({ label: "مسبح للسيدات" });
    expect(res.status).toBe("created");
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ code: "custom_amenity", label: "مسبح للسيدات" }),
    );
  });

  it("sorts a picker addition past everything already seeded", async () => {
    taxonomy.rows.push(entry("storage", "Storage", { sort_order: 210 }));
    await addAmenityToTaxonomy({ label: "Wine cellar" });
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 220 }),
    );
  });

  it("reports a failed write instead of pretending it landed", async () => {
    // The picker's cue to keep the value as free text on the listing.
    upsertSpy.mockImplementationOnce(async () => false);
    const res = await addAmenityToTaxonomy({ label: "Wine cellar" });
    expect(res.status).toBe("error");
  });

  it("refuses a name past the picker's own cap", async () => {
    const res = await addAmenityToTaxonomy({ label: "x".repeat(51) });
    expect(res.status).toBe("error");
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("falls back to a real category when handed a made-up one", async () => {
    const res = await addAmenityToTaxonomy({
      label: "Wine cellar",
      category: "basement",
    });
    expect(res.status).toBe("created");
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ category: "building" }),
    );
  });
});
