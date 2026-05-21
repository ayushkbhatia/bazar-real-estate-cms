import { describe, it, expect } from "vitest";
import {
  computePaymentBreakdown,
  developmentEditSchema,
  formatStartingPrice,
  normaliseDevelopmentInput,
  paymentPlanSchema,
  quarterLabel,
} from "./development";

describe("formatStartingPrice", () => {
  it("returns em-dash for null", () => {
    expect(formatStartingPrice(null)).toBe("—");
  });
  it("formats millions", () => {
    expect(formatStartingPrice(6_200_000)).toBe("AED 6.2M");
    expect(formatStartingPrice(12_500_000)).toBe("AED 12.5M");
  });
  it("formats thousands", () => {
    expect(formatStartingPrice(450_000)).toBe("AED 450K");
  });
  it("formats sub-thousands literally", () => {
    expect(formatStartingPrice(900)).toBe("AED 900");
  });
});

describe("quarterLabel", () => {
  it("returns em-dash for empty input", () => {
    expect(quarterLabel(null)).toBe("—");
    expect(quarterLabel(undefined)).toBe("—");
    expect(quarterLabel("")).toBe("—");
    expect(quarterLabel("not-a-date")).toBe("—");
  });
  it("maps each month to its calendar quarter", () => {
    expect(quarterLabel("2028-01-15")).toBe("Q1 2028");
    expect(quarterLabel("2028-03-31")).toBe("Q1 2028");
    expect(quarterLabel("2028-04-01")).toBe("Q2 2028");
    expect(quarterLabel("2028-07-15")).toBe("Q3 2028");
    expect(quarterLabel("2028-10-30")).toBe("Q4 2028");
    expect(quarterLabel("2028-12-31")).toBe("Q4 2028");
  });
});

describe("normaliseDevelopmentInput", () => {
  it("coerces empty-string text fields to null", () => {
    const out = normaliseDevelopmentInput({
      name: "X",
      slug: "x",
      status: "pre_launch",
      tagline: "",
      description: "",
      vision: "",
    }) as Record<string, unknown>;
    expect(out.tagline).toBeNull();
    expect(out.description).toBeNull();
    expect(out.vision).toBeNull();
  });
  it("coerces numeric strings to numbers and empty strings to null", () => {
    const out = normaliseDevelopmentInput({
      total_units: "312",
      starting_price: "",
    }) as Record<string, unknown>;
    expect(out.total_units).toBe(312);
    expect(out.starting_price).toBeNull();
  });
  it("leaves non-numeric junk as null", () => {
    const out = normaliseDevelopmentInput({
      total_units: "not-a-number",
    }) as Record<string, unknown>;
    expect(out.total_units).toBeNull();
  });
});

describe("developmentEditSchema", () => {
  it("accepts a well-formed minimum payload", () => {
    const r = developmentEditSchema.safeParse({
      name: "Saadiyat Lagoons",
      slug: "saadiyat-lagoons",
      status: "pre_launch",
      developer_id: "22222222-0000-0000-0000-000000000001",
      area_id: null,
      handover_date: null,
      total_units: 312,
      starting_price: 6_200_000,
      tagline: null,
      bedrooms_text: null,
      description: null,
      vision: null,
      escrow_account: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects bad slugs", () => {
    const r = developmentEditSchema.safeParse({
      name: "X",
      slug: "Has Spaces",
      status: "pre_launch",
      developer_id: "22222222-0000-0000-0000-000000000001",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown status", () => {
    const r = developmentEditSchema.safeParse({
      name: "X",
      slug: "x",
      status: "bogus",
      developer_id: "22222222-0000-0000-0000-000000000001",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty developer_id", () => {
    const r = developmentEditSchema.safeParse({
      name: "X",
      slug: "x",
      status: "pre_launch",
      developer_id: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("paymentPlanSchema", () => {
  it("parses a real-world plan", () => {
    const r = paymentPlanSchema.safeParse({
      name: "60/40 post-handover",
      milestones: [
        { percent: 10, label: "Booking", timing: "Today" },
        { percent: 20, label: "Handover", timing: "Q1 2028" },
        { percent: 70, label: "Post-handover", timing: "Q1 2030" },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("rejects an empty milestone list", () => {
    const r = paymentPlanSchema.safeParse({
      name: "Empty plan",
      milestones: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("computePaymentBreakdown", () => {
  const plan = paymentPlanSchema.parse({
    name: "60/40 post-handover",
    milestones: [
      { percent: 10, label: "Booking", timing: "Today" },
      { percent: 10, label: "Within 30 days", timing: "+30 days" },
      { percent: 10, label: "Foundations", timing: "Jan 2027" },
      { percent: 10, label: "30% construction", timing: "Aug 2027" },
      { percent: 20, label: "Handover", timing: "Q1 2028" },
      { percent: 20, label: "12mo post", timing: "Q1 2029" },
      { percent: 20, label: "24mo post", timing: "Q1 2030" },
    ],
    construction_pct: 40,
    handover_pct: 20,
    post_handover_pct: 40,
    post_handover_months: 24,
  });

  it("partitions price into construction / handover / post-handover", () => {
    const b = computePaymentBreakdown(plan, 6_200_000);
    expect(b.total).toBe(6_200_000);
    expect(b.construction).toBe(2_480_000); // 40% of 6.2M
    expect(b.handover).toBe(1_240_000); // 20%
    expect(b.postHandover).toBe(2_480_000); // 40%
  });

  it("handles price = 0 cleanly", () => {
    const b = computePaymentBreakdown(plan, 0);
    expect(b).toEqual({
      total: 0,
      construction: 0,
      handover: 0,
      postHandover: 0,
    });
  });

  it("falls back to explicit pcts when no 'Handover' label exists", () => {
    const noHandoverPlan = paymentPlanSchema.parse({
      name: "Custom",
      milestones: [{ percent: 100, label: "Booking" }],
      construction_pct: 30,
      handover_pct: 50,
      post_handover_pct: 20,
    });
    const b = computePaymentBreakdown(noHandoverPlan, 1_000_000);
    expect(b.construction).toBe(300_000);
    expect(b.handover).toBe(500_000);
    expect(b.postHandover).toBe(200_000);
  });

  it("returns total only when plan is null", () => {
    expect(computePaymentBreakdown(null, 1_000_000)).toEqual({
      total: 1_000_000,
      construction: 0,
      handover: 0,
      postHandover: 0,
    });
  });

  it("never matches 'post-handover' as the handover row", () => {
    const trickyPlan = paymentPlanSchema.parse({
      name: "Mostly-post",
      milestones: [
        { percent: 25, label: "Booking" },
        { percent: 25, label: "Handover" },
        { percent: 50, label: "Post-handover instalments" },
      ],
    });
    const b = computePaymentBreakdown(trickyPlan, 1_000_000);
    expect(b.construction).toBe(250_000);
    expect(b.handover).toBe(250_000);
    expect(b.postHandover).toBe(500_000);
  });
});
