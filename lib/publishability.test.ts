import { describe, it, expect } from "vitest";
import {
  evaluatePublishability,
  type PublishabilityInput,
} from "./publishability";

const FUTURE = "2099-12-31";
const PAST = "2010-01-01";

function base(): PublishabilityInput {
  return {
    status: "draft",
    has_hero: true,
    has_developer: true,
    poa_optional: true,
    listing_permit_no: "ORN-12345-AD",
    listing_permit_expires_at: FUTURE,
    slug: "mamsha-3-bed-beachfront-apartment",
    title: "Mamsha · 3-bed beachfront",
    price_aed: 4_200_000,
    compliance: {
      form_a: true,
      title_deed: true,
      noc: true,
      power_of_attorney: true,
    },
  };
}

describe("evaluatePublishability", () => {
  it("returns ok when every check passes", () => {
    const res = evaluatePublishability(base());
    expect(res.ok).toBe(true);
    expect(res.blockers).toEqual([]);
    expect(res.checks.every((c) => c.passed)).toBe(true);
  });

  it("blocks when no hero is set", () => {
    const res = evaluatePublishability({ ...base(), has_hero: false });
    expect(res.ok).toBe(false);
    expect(res.blockers).toContain("No hero image set");
  });

  it("blocks when any compliance flag is missing", () => {
    const res = evaluatePublishability({
      ...base(),
      compliance: {
        form_a: true,
        title_deed: false,
        noc: true,
        power_of_attorney: true,
      },
    });
    expect(res.ok).toBe(false);
    expect(res.blockers.some((b) => b.includes("Title deed"))).toBe(true);
  });

  it("blocks on the three REQUIRED compliance items when compliance is null", () => {
    const res = evaluatePublishability({ ...base(), compliance: null });
    expect(res.ok).toBe(false);
    // Form A, Title deed, NOC are required; Power of Attorney is optional.
    const complianceBlockers = res.blockers.filter((b) =>
      /Form A|Title deed|NOC/i.test(b),
    );
    expect(complianceBlockers).toHaveLength(3);
    expect(res.blockers.some((b) => /Power of Attorney/i.test(b))).toBe(false);
  });

  it("does NOT block when only Power of Attorney is unticked (optional)", () => {
    const res = evaluatePublishability({
      ...base(),
      compliance: {
        form_a: true,
        title_deed: true,
        noc: true,
        power_of_attorney: false,
      },
    });
    expect(res.ok).toBe(true);
  });

  it("blocks when no developer is set", () => {
    const res = evaluatePublishability({ ...base(), has_developer: false });
    expect(res.ok).toBe(false);
    expect(res.blockers).toContain("Developer is missing");
  });

  it("blocks when permit is missing or expired", () => {
    const noPermit = evaluatePublishability({
      ...base(),
      listing_permit_no: null,
    });
    expect(noPermit.blockers).toContain("Listing permit number is missing");

    const expired = evaluatePublishability({
      ...base(),
      listing_permit_expires_at: PAST,
    });
    expect(
      expired.blockers.some((b) => b.toLowerCase().includes("expires_at")),
    ).toBe(true);
  });

  it("blocks when slug is invalid", () => {
    const res = evaluatePublishability({
      ...base(),
      slug: "Mamsha 3 Bed",
    });
    expect(res.ok).toBe(false);
    expect(
      res.blockers.some((b) => b.toLowerCase().includes("slug")),
    ).toBe(true);
  });

  it("blocks when title is too short or null", () => {
    expect(
      evaluatePublishability({ ...base(), title: "Hi" }).blockers,
    ).toContain("Title is missing");
    expect(
      evaluatePublishability({ ...base(), title: null }).blockers,
    ).toContain("Title is missing");
  });

  it("blocks when price is zero or missing", () => {
    expect(evaluatePublishability({ ...base(), price_aed: 0 }).ok).toBe(false);
    expect(evaluatePublishability({ ...base(), price_aed: null }).ok).toBe(false);
  });

  it("permit expiry exactly at `now` passes", () => {
    const now = new Date("2026-05-21T00:00:00Z");
    const res = evaluatePublishability({
      ...base(),
      listing_permit_expires_at: "2026-05-21",
      now,
    });
    expect(res.ok).toBe(true);
  });

  it("aggregates several blockers when multiple checks fail", () => {
    const res = evaluatePublishability({
      ...base(),
      has_hero: false,
      compliance: null,
      title: null,
      slug: "BAD",
      price_aed: null,
      listing_permit_no: null,
      listing_permit_expires_at: null,
    });
    expect(res.ok).toBe(false);
    expect(res.blockers.length).toBeGreaterThanOrEqual(7);
  });
});
