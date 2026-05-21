import { describe, expect, it } from "vitest";
import { bulkInputSchema, bulkPatchSchema } from "./patch-schema";
import { BULK_SELECTION_CAP } from "./selection";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("bulkPatchSchema", () => {
  it("accepts a status-only patch", () => {
    expect(
      bulkPatchSchema.safeParse({ status: "published" }).success,
    ).toBe(true);
  });

  it("accepts a reassign patch with a uuid", () => {
    expect(
      bulkPatchSchema.safeParse({ assigned_agent_id: UUID_A }).success,
    ).toBe(true);
  });

  it("accepts a reassign-to-none patch (null)", () => {
    const r = bulkPatchSchema.safeParse({ assigned_agent_id: null });
    expect(r.success).toBe(true);
  });

  it("rejects an empty patch", () => {
    const r = bulkPatchSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/at least one/i);
    }
  });

  it("rejects an unknown status enum value", () => {
    expect(
      bulkPatchSchema.safeParse({ status: "vibing" }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid agent id", () => {
    expect(
      bulkPatchSchema.safeParse({ assigned_agent_id: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("accepts a multi-field patch", () => {
    const r = bulkPatchSchema.safeParse({
      status: "off_market",
      assigned_agent_id: UUID_B,
    });
    expect(r.success).toBe(true);
  });
});

describe("bulkInputSchema", () => {
  it("rejects an empty ids array", () => {
    const r = bulkInputSchema.safeParse({
      ids: [],
      patch: { status: "published" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects more ids than the selection cap", () => {
    const ids = Array.from({ length: BULK_SELECTION_CAP + 1 }, (_, i) =>
      String(i).padStart(12, "x"),
    );
    const r = bulkInputSchema.safeParse({
      ids,
      patch: { status: "published" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects ids with illegal characters", () => {
    const r = bulkInputSchema.safeParse({
      ids: ["legit-uuid-here-1234", "has space"],
      patch: { status: "published" },
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid request at the cap", () => {
    const ids = Array.from({ length: BULK_SELECTION_CAP }, (_, i) =>
      String(i).padStart(12, "x"),
    );
    const r = bulkInputSchema.safeParse({
      ids,
      patch: { status: "off_market" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects when patch is empty", () => {
    const r = bulkInputSchema.safeParse({ ids: [UUID_A], patch: {} });
    expect(r.success).toBe(false);
  });
});
