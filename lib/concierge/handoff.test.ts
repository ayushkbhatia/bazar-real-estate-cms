import { describe, it, expect } from "vitest";
import { formatBriefForWhatsApp } from "./handoff";
import type { ConciergeBrief } from "./brief";

const EMPTY: ConciergeBrief = { chips: [] };

describe("formatBriefForWhatsApp", () => {
  it("emits the opener line even when the brief is empty", () => {
    const msg = formatBriefForWhatsApp(EMPTY);
    expect(msg).toBe("Hi Bazar — I'd like an advisor's view on this brief.");
  });

  it("includes mode, area, beds, budget for a typical buy brief", () => {
    const msg = formatBriefForWhatsApp({
      ...EMPTY,
      mode: "buy",
      area_slugs: ["saadiyat-island"],
      beds_min: 3,
      beds_max: 3,
      price_min: 4_000_000,
      price_max: 6_000_000,
    });
    expect(msg).toContain("Looking to: Buy");
    expect(msg).toContain("Area: Saadiyat Island");
    expect(msg).toContain("Beds: 3");
    expect(msg).toContain("Budget: AED 4.0M – AED 6.0M");
  });

  it("pluralizes Area when multiple slugs are set", () => {
    const msg = formatBriefForWhatsApp({
      ...EMPTY,
      area_slugs: ["saadiyat-island", "yas-island"],
    });
    expect(msg).toContain("Areas: Saadiyat Island, Yas Island");
  });

  it("renders bed range as X+ when only the minimum is set", () => {
    const msg = formatBriefForWhatsApp({ ...EMPTY, beds_min: 4 });
    expect(msg).toContain("Beds: 4+");
  });

  it("renders bed range as X–Y when min and max differ", () => {
    const msg = formatBriefForWhatsApp({
      ...EMPTY,
      beds_min: 2,
      beds_max: 4,
    });
    expect(msg).toContain("Beds: 2–4");
  });

  it("renders budget with from / up to wording when only one bound is set", () => {
    const lower = formatBriefForWhatsApp({ ...EMPTY, price_min: 2_000_000 });
    expect(lower).toContain("Budget: from AED 2.0M");
    const upper = formatBriefForWhatsApp({ ...EMPTY, price_max: 8_500_000 });
    expect(upper).toContain("Budget: up to AED 8.5M");
  });

  it("lists must-have amenities when supplied", () => {
    const msg = formatBriefForWhatsApp({
      ...EMPTY,
      must_have_amenities: ["Private pool", "Smart home"],
    });
    expect(msg).toContain("Must have: Private pool, Smart home");
  });

  it("surfaces flags as a comma-joined filter list", () => {
    const msg = formatBriefForWhatsApp({
      ...EMPTY,
      flags: {
        exclusive: true,
        vacant_on_transfer: true,
        mortgage_eligible: false,
      },
    });
    expect(msg).toContain("Filters: exclusive only, vacant on transfer");
    expect(msg).not.toContain("mortgageable now");
  });

  it("omits the details block when nothing is set (just the opener)", () => {
    const msg = formatBriefForWhatsApp({
      ...EMPTY,
      // Empty arrays should be treated as no signal, not as "all".
      area_slugs: [],
      property_types: [],
      must_have_amenities: [],
    });
    expect(msg).toBe("Hi Bazar — I'd like an advisor's view on this brief.");
  });
});
