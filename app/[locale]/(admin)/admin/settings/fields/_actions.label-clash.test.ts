/**
 * @vitest-environment node
 *
 * The taxonomy keys on code, but the catalogue stores labels — so the editor
 * used to accept a second entry with an identical label as long as the code
 * differed, which is how the live table ended up with eight duplicated labels
 * (balconyy, sea_vieww, playgroundd…). Migration 0106 makes Postgres refuse
 * them; these cover the app-side half, which is what turns the refusal into a
 * message naming the entry that is in the way.
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

const { createAmenity, toggleAmenityActive } = await import("./_actions");

function entry(
  code: string,
  label: string,
  active = true,
): AmenityTaxonomyEntry {
  return {
    code,
    label,
    category: "outdoor",
    icon: null,
    sort_order: 0,
    active,
  };
}

beforeEach(() => {
  upsertSpy.mockClear();
  taxonomy.rows = [entry("playground", "Playground")];
});

describe("createAmenity", () => {
  it("refuses a second entry with the same label under a fresh code", async () => {
    const res = await createAmenity({
      code: "playgroundd",
      label: "Playground",
      category: "community",
      sort_order: 0,
    });
    expect(res.status).toBe("error");
    if (res.status !== "error") return;
    // Names the entry in the way — the old message only said the *code* was
    // free, which is what invited the doubled-letter workaround.
    expect(res.message).toContain("playground");
    expect(res.fieldErrors?.label).toBeTruthy();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("matches labels the way the catalogue does — case and spacing folded", async () => {
    const res = await createAmenity({
      code: "play_area",
      label: "  playground ",
      category: "community",
      sort_order: 0,
    });
    expect(res.status).toBe("error");
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("ignores an inactive namesake — that pair is already resolved", async () => {
    taxonomy.rows = [entry("playground", "Playground", false)];
    const res = await createAmenity({
      code: "playgroundd",
      label: "Playground",
      category: "community",
      sort_order: 0,
    });
    expect(res.status).toBe("ok");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it("still lets a genuinely new label through", async () => {
    const res = await createAmenity({
      code: "padel_court",
      label: "Padel court",
      category: "outdoor",
      sort_order: 0,
    });
    expect(res.status).toBe("ok");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});

describe("toggleAmenityActive", () => {
  it("refuses to switch a row back on into a live label collision", async () => {
    taxonomy.rows = [
      entry("playground", "Playground", false),
      entry("playgroundd", "Playground", true),
    ];
    const res = await toggleAmenityActive("playground", true);
    expect(res.status).toBe("error");
    if (res.status !== "error") return;
    expect(res.message).toContain("playgroundd");
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("always allows switching one off — that is how a collision gets fixed", async () => {
    taxonomy.rows = [
      entry("playground", "Playground", true),
      entry("playgroundd", "Playground", true),
    ];
    const res = await toggleAmenityActive("playground", false);
    expect(res.status).toBe("ok");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it("switches a row back on when nothing else claims its label", async () => {
    taxonomy.rows = [entry("playground", "Playground", false)];
    const res = await toggleAmenityActive("playground", true);
    expect(res.status).toBe("ok");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});
