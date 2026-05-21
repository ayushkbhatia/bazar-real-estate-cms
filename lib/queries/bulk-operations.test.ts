import { describe, expect, it } from "vitest";
import { BULK_OPERATIONS_PAGE_SIZE } from "./bulk-operations";

// Most of `bulk-operations.ts` depends on Supabase server-only clients that
// can't be exercised from vitest without mocking the entire SSR cookie
// stack. The pure shape we expose — the page size constant — is what
// the audit-log paginator depends on, so this test pins it down.

describe("bulk-operations module constants", () => {
  it("exports a positive integer page size", () => {
    expect(Number.isInteger(BULK_OPERATIONS_PAGE_SIZE)).toBe(true);
    expect(BULK_OPERATIONS_PAGE_SIZE).toBeGreaterThan(0);
  });

  it("uses a reasonable page size for the audit viewer", () => {
    // 20 is too small for an admin index, 200 too noisy. Pin between.
    expect(BULK_OPERATIONS_PAGE_SIZE).toBeGreaterThanOrEqual(25);
    expect(BULK_OPERATIONS_PAGE_SIZE).toBeLessThanOrEqual(100);
  });
});
