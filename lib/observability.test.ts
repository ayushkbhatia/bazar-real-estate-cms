import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const { normaliseMessage, fingerprintOf } = await import("./observability");

describe("normaliseMessage", () => {
  it("collapses the ids that make every occurrence look different", () => {
    // The point of the whole file. A cron failing all night on different rows
    // must be one row with a count, not one row per row it failed on.
    const a = normaliseMessage(
      "lead 3f1c9e64-1111-4222-8333-444455556666 could not be pushed",
    );
    const b = normaliseMessage(
      "lead 99aabbcc-2222-4333-8444-555566667777 could not be pushed",
    );
    expect(a).toBe(b);
    expect(a).toContain("<id>");
  });

  it("collapses Salesforce record ids", () => {
    expect(normaliseMessage("record a04iy0000000PsrAAE is deleted")).toBe(
      normaliseMessage("record a04iy0000000QqzBBF is deleted"),
    );
  });

  it("collapses quoted values and bare numbers", () => {
    expect(normaliseMessage('bad picklist value "Lease"')).toBe(
      normaliseMessage('bad picklist value "Sublet"'),
    );
    expect(normaliseMessage("timed out after 30s")).toBe(
      normaliseMessage("timed out after 45s"),
    );
  });

  it("keeps genuinely different problems apart", () => {
    // Over-collapsing is the failure mode that matters: two unrelated bugs
    // filed as one issue means the second is invisible.
    expect(normaliseMessage("connection reset")).not.toBe(
      normaliseMessage("permission denied"),
    );
  });
});

describe("fingerprintOf", () => {
  it("is stable for the same problem", () => {
    expect(fingerprintOf("cron/x", "lead 111 failed")).toBe(
      fingerprintOf("cron/x", "lead 222 failed"),
    );
  });

  it("separates the same message from different sources", () => {
    // "connection reset" in the Salesforce push and in the audit log are two
    // problems, and grouping them would send someone to the wrong place.
    expect(fingerprintOf("cron/x", "connection reset")).not.toBe(
      fingerprintOf("audit", "connection reset"),
    );
  });

  it("is short enough to index and long enough not to collide", () => {
    const fp = fingerprintOf("cron/x", "boom");
    expect(fp).toHaveLength(32);
    expect(fp).toMatch(/^[0-9a-f]+$/);
  });
});
