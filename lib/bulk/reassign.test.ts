import { describe, expect, it } from "vitest";
import { bulkInputSchema } from "./patch-schema";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const ID_A = "id-aaaa-aaaa-1111";

describe("reassign input validation (via bulkInputSchema)", () => {
  it("accepts a valid uuid in assigned_agent_id", () => {
    const r = bulkInputSchema.safeParse({
      ids: [ID_A],
      patch: { assigned_agent_id: VALID_UUID },
    });
    expect(r.success).toBe(true);
  });

  it("accepts null in assigned_agent_id (clear assignment)", () => {
    const r = bulkInputSchema.safeParse({
      ids: [ID_A],
      patch: { assigned_agent_id: null },
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-uuid agent id", () => {
    const r = bulkInputSchema.safeParse({
      ids: [ID_A],
      patch: { assigned_agent_id: "not-a-uuid" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an undefined patch (must change at least one field)", () => {
    const r = bulkInputSchema.safeParse({
      ids: [ID_A],
      patch: {},
    });
    expect(r.success).toBe(false);
  });

  it("accepts a mix of status + assigned_agent_id", () => {
    const r = bulkInputSchema.safeParse({
      ids: [ID_A],
      patch: { status: "off_market", assigned_agent_id: VALID_UUID },
    });
    expect(r.success).toBe(true);
  });
});
