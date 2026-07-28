import { describe, it, expect } from "vitest";
import {
  evaluatePublishability,
  type PublishabilityInput,
} from "./publishability";
import {
  normaliseEditInput,
  propertyEditSchema,
  type PropertyEditInput,
} from "./schemas/property";

const FUTURE = "2099-12-31";
const PAST = "2010-01-01";

function base(): PublishabilityInput {
  return {
    status: "draft",
    has_developer: true,
    listing_permit_no: "ORN-12345-AD",
    listing_permit_expires_at: FUTURE,
    slug: "mamsha-3-bed-beachfront-apartment",
    title: "Mamsha · 3-bed beachfront",
    price_aed: 4_200_000,
  };
}

describe("evaluatePublishability", () => {
  it("returns ok when every check passes", () => {
    const res = evaluatePublishability(base());
    expect(res.ok).toBe(true);
    expect(res.blockers).toEqual([]);
    expect(res.checks.every((c) => c.passed)).toBe(true);
  });

  it("does not gate on paperwork or hero imagery", () => {
    const labels = evaluatePublishability(base()).checks.map((c) =>
      c.label.toLowerCase(),
    );
    for (const gone of ["form a", "title deed", "noc", "power of attorney", "hero"]) {
      expect(labels.some((l) => l.includes(gone))).toBe(false);
    }
  });

  it("blocks when no developer is set", () => {
    const res = evaluatePublishability({ ...base(), has_developer: false });
    expect(res.ok).toBe(false);
    expect(res.blockers).toContain("Developer is missing");
  });

  it("skips the developer check when the caller doesn't track it", () => {
    const { has_developer: _omitted, ...withoutDeveloper } = base();
    const res = evaluatePublishability(withoutDeveloper);
    expect(res.ok).toBe(true);
    expect(res.checks.some((c) => c.label.includes("Developer"))).toBe(false);
  });

  it("blocks when permit is missing or expired", () => {
    const noPermit = evaluatePublishability({
      ...base(),
      listing_permit_no: null,
    });
    expect(noPermit.blockers).toContain("Listing permit number is missing");

    const blankPermit = evaluatePublishability({
      ...base(),
      listing_permit_no: "   ",
    });
    expect(blankPermit.blockers).toContain("Listing permit number is missing");

    const expired = evaluatePublishability({
      ...base(),
      listing_permit_expires_at: PAST,
    });
    expect(
      expired.blockers.some((b) => b.toLowerCase().includes("expires_at")),
    ).toBe(true);

    const noExpiry = evaluatePublishability({
      ...base(),
      listing_permit_expires_at: null,
    });
    expect(noExpiry.ok).toBe(false);
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

  // The permit checks are only worth anything if they read what the property
  // editor actually writes. This walks the real path: raw form values →
  // normaliseEditInput → propertyEditSchema → the saved column values → gate.
  describe("permit checks against real editor output", () => {
    const RAW_FORM_VALUES = {
      title: "Mamsha · 3-bed beachfront",
      short_description: "",
      type: "apartment",
      mode: "buy",
      developer_id: "11111111-1111-1111-1111-111111111111",
      price_aed: "4200000",
      beds: "3",
      baths: "4",
      amenities: [],
      slug: "mamsha-3-bed-beachfront",
      area_id: "",
      listing_permit_no: "ORN-12345-AD",
      listing_permit_expires_at: "2099-12-31",
    };

    function gateFromForm(overrides: Record<string, unknown> = {}) {
      const parsed = propertyEditSchema.parse(
        normaliseEditInput({ ...RAW_FORM_VALUES, ...overrides }),
      ) as PropertyEditInput;
      return evaluatePublishability({
        status: "draft",
        has_developer: parsed.developer_id !== "",
        listing_permit_no: parsed.listing_permit_no ?? null,
        listing_permit_expires_at: parsed.listing_permit_expires_at ?? null,
        slug: parsed.slug,
        title: parsed.title,
        price_aed: parsed.price_aed,
      });
    }

    it("passes both permit checks for a filled-in editor form", () => {
      const res = gateFromForm();
      expect(res.ok).toBe(true);
      expect(
        res.checks.find((c) => c.label === "Listing permit no. is recorded")
          ?.passed,
      ).toBe(true);
      expect(
        res.checks.find((c) => c.label === "Listing permit not expired")
          ?.passed,
      ).toBe(true);
    });

    it("fails when the permit fields are left blank in the editor", () => {
      // Blank inputs arrive as "" and are normalised to null before the save.
      const res = gateFromForm({
        listing_permit_no: "",
        listing_permit_expires_at: "",
      });
      expect(res.ok).toBe(false);
      expect(res.blockers).toContain("Listing permit number is missing");
      expect(res.blockers).toContain(
        "Listing permit expires_at is missing or in the past",
      );
    });

    it("fails when the editor's date picker holds a past expiry", () => {
      const res = gateFromForm({ listing_permit_expires_at: "2010-01-01" });
      expect(res.ok).toBe(false);
      expect(
        res.checks.find((c) => c.label === "Listing permit not expired")
          ?.passed,
      ).toBe(false);
    });

    it("fails on both layers when the developer dropdown was never touched", () => {
      // A fresh draft has developer_id "" in the form and null in the row, so
      // the editor refuses to save it AND the gate blocks the publish.
      const parsed = propertyEditSchema.safeParse(
        normaliseEditInput({ ...RAW_FORM_VALUES, developer_id: "" }),
      );
      expect(parsed.success).toBe(false);

      const res = evaluatePublishability({ ...base(), has_developer: false });
      expect(res.blockers).toContain("Developer is missing");
    });
  });

  it("aggregates several blockers when multiple checks fail", () => {
    const res = evaluatePublishability({
      ...base(),
      has_developer: false,
      title: null,
      slug: "BAD",
      price_aed: null,
      listing_permit_no: null,
      listing_permit_expires_at: null,
    });
    expect(res.ok).toBe(false);
    expect(res.blockers.length).toBe(6);
  });
});
