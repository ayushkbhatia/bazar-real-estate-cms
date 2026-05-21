import { describe, expect, it } from "vitest";
import {
  evaluateBulkPublishability,
  type BulkPropertyRow,
} from "./properties-bulk";

const FUTURE = "2099-12-31";

function fixture(overrides: Partial<BulkPropertyRow> = {}): BulkPropertyRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference: "BAZ-AD-04891",
    slug: "mamsha-3-bed",
    title: "Mamsha · 3-bed",
    status: "draft",
    price_aed: 4_200_000,
    listing_permit_no: "ORN-12345-AD",
    listing_permit_expires_at: FUTURE,
    has_hero: true,
    compliance: {
      form_a: true,
      title_deed: true,
      noc: true,
      power_of_attorney: true,
    },
    ...overrides,
  };
}

describe("evaluateBulkPublishability", () => {
  it("passes when every gate is satisfied", () => {
    const r = evaluateBulkPublishability(fixture());
    expect(r.ok).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it("flags a missing hero", () => {
    const r = evaluateBulkPublishability(fixture({ has_hero: false }));
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => /hero/i.test(b))).toBe(true);
  });

  it("flags an expired permit", () => {
    const r = evaluateBulkPublishability(
      fixture({ listing_permit_expires_at: "2010-01-01" }),
    );
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => /permit/i.test(b))).toBe(true);
  });

  it("flags missing compliance flags", () => {
    const r = evaluateBulkPublishability(
      fixture({
        compliance: { form_a: false, title_deed: true, noc: true, power_of_attorney: true },
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => /form a/i.test(b))).toBe(true);
  });

  it("accepts a null compliance blob (treats every flag as false)", () => {
    const r = evaluateBulkPublishability(fixture({ compliance: null }));
    expect(r.ok).toBe(false);
    expect(r.blockers.length).toBeGreaterThanOrEqual(4); // all 4 compliance checks fail
  });

  it("flags an invalid slug", () => {
    const r = evaluateBulkPublishability(fixture({ slug: "Bad Slug!" }));
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => /slug/i.test(b))).toBe(true);
  });
});
