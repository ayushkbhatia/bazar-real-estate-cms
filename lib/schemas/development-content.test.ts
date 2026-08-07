import { describe, it, expect } from "vitest";
import {
  blankFeature,
  blankMilestone,
  developmentContentSchema,
  milestoneTotal,
  paymentPlanSchema,
} from "./development-content";
import { paymentPlanSchema as readPaymentPlanSchema } from "./development";

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
  it("accepts the catalogue's seeded ids, not just RFC-conformant uuids", () => {
    // `33333333-0000-…` has a zero version nibble, so zod's .uuid() rejects
    // it — and every seeded development is numbered that way, which made
    // picking any neighbour impossible.
    const seeded = {
      ...VALID,
      nearby_ids: ["33333333-0000-0000-0000-000000000008"],
      lead_advisor_id: "22222222-0000-0000-0000-000000000001",
    };
    expect(developmentContentSchema.safeParse(seeded).success).toBe(true);
  });

  it("still rejects something that isn't an id at all", () => {
    expect(
      developmentContentSchema.safeParse({ ...VALID, nearby_ids: ["nope"] })
        .success,
    ).toBe(false);
  });

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

/**
 * The two payment-plan schemas sit on opposite ends of the same jsonb column:
 * this file's validates what the page editor saves, `development.ts`'s
 * validates what the public page reads back. They drifted once — the writer
 * emitted `null` for blank optional fields, the reader only accepted absent —
 * and because the reader discards a plan it can't parse, every project
 * configured through the editor lost its timeline, hero stat and FAQ entry
 * with no error raised anywhere. Anything the writer accepts, the reader must.
 */
describe("write/read payment plan compatibility", () => {
  const cases: Record<string, unknown> = {
    "all optionals blank, as the editor saves them": {
      name: "50/50 Payment Plan",
      milestones: [
        { label: "Booking", timing: null, percent: 5 },
        { label: "On Handover", timing: null, percent: 95 },
      ],
      construction_pct: null,
      handover_pct: null,
      post_handover_pct: null,
      post_handover_months: null,
    },
    "every field at the editor's maximum length": {
      name: "n".repeat(60),
      milestones: [
        { label: "l".repeat(60), timing: "t".repeat(60), percent: 100 },
      ],
      construction_pct: 100,
      handover_pct: 100,
      post_handover_pct: 100,
      post_handover_months: 120,
    },
    "the twelve-milestone ceiling": {
      name: "Twelve stages",
      milestones: Array.from({ length: 12 }, (_, i) => ({
        label: `Stage ${i + 1}`,
        timing: null,
        percent: 0,
      })),
      construction_pct: null,
      handover_pct: null,
      post_handover_pct: null,
      post_handover_months: null,
    },
  };

  for (const [name, plan] of Object.entries(cases)) {
    it(`the reader accepts ${name}`, () => {
      // Sanity: the writer accepts it, so the reader has to.
      expect(paymentPlanSchema.safeParse(plan).success).toBe(true);
      const read = readPaymentPlanSchema.safeParse(plan);
      expect(read.success).toBe(true);
    });
  }

  it("a blank milestone label is caught on the way in, not lost on the way out", () => {
    // The one asymmetry we want: the writer is *stricter*. `blankMilestone()`
    // has an empty label, which the editor rejects at save time with a visible
    // error — much better than the page quietly dropping the plan later.
    expect(
      paymentPlanSchema.safeParse({
        name: "Unfinished",
        milestones: [blankMilestone()],
      }).success,
    ).toBe(false);
  });
});
