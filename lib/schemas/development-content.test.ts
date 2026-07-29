import { describe, it, expect } from "vitest";
import {
  blankFeature,
  blankMilestone,
  developmentContentSchema,
  milestoneTotal,
  paymentPlanSchema,
} from "./development-content";

const VALID = {
  payment_plan: {
    name: "60/40 post-handover",
    milestones: [
      { label: "Booking", timing: "Today", percent: 20 },
      { label: "Handover", timing: "Q4 2027", percent: 80 },
    ],
    construction_pct: null,
    handover_pct: null,
    post_handover_pct: null,
    post_handover_months: 24,
  },
  feature_blocks: [],
  faq: [],
  coords: null,
  nearby_ids: [],
  lead_advisor_id: null,
};

describe("payment plan", () => {
  it("accepts a plan with stages", () => {
    expect(paymentPlanSchema.safeParse(VALID.payment_plan).success).toBe(true);
  });

  it("rejects a percentage outside 0–100", () => {
    const bad = {
      ...VALID.payment_plan,
      milestones: [{ label: "Booking", timing: null, percent: 140 }],
    };
    expect(paymentPlanSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a plan with no stages at all", () => {
    expect(
      paymentPlanSchema.safeParse({ ...VALID.payment_plan, milestones: [] })
        .success,
    ).toBe(false);
  });

  it("totals stages so the editor can warn when they don't reach 100", () => {
    expect(milestoneTotal(VALID.payment_plan.milestones)).toBe(100);
    expect(milestoneTotal([{ percent: 10 }, { percent: 25 }])).toBe(35);
    // A blank stage contributes nothing rather than NaN.
    expect(milestoneTotal([blankMilestone()])).toBe(0);
  });
});

describe("development content", () => {
  it("caps future neighbours at three, matching the design", () => {
    const four = { ...VALID, nearby_ids: Array(4).fill(crypto.randomUUID()) };
    expect(developmentContentSchema.safeParse(four).success).toBe(false);

    const three = {
      ...VALID,
      nearby_ids: [crypto.randomUUID(), crypto.randomUUID()],
    };
    expect(developmentContentSchema.safeParse(three).success).toBe(true);
  });

  it("requires copy on a feature block rather than saving an empty card", () => {
    const empty = { ...VALID, feature_blocks: [blankFeature(0)] };
    expect(developmentContentSchema.safeParse(empty).success).toBe(false);

    const filled = {
      ...VALID,
      feature_blocks: [
        { ...blankFeature(0), title: "The beach club", copy: "Members only." },
      ],
    };
    expect(developmentContentSchema.safeParse(filled).success).toBe(true);
  });

  it("keeps coordinates on the globe", () => {
    expect(
      developmentContentSchema.safeParse({
        ...VALID,
        coords: { lat: 24.5, lng: 54.4 },
      }).success,
    ).toBe(true);
    expect(
      developmentContentSchema.safeParse({
        ...VALID,
        coords: { lat: 100, lng: 54.4 },
      }).success,
    ).toBe(false);
  });

  it("allows no plan at all — the section then stays hidden", () => {
    expect(
      developmentContentSchema.safeParse({ ...VALID, payment_plan: null })
        .success,
    ).toBe(true);
  });
});
