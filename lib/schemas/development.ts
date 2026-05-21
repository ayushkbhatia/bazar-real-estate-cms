import { z } from "zod";

export const DEVELOPMENT_STATUSES = [
  "pre_launch",
  "on_sale",
  "sold_out",
  "handed_over",
] as const;

export const UNIT_STATUSES = [
  "available",
  "held",
  "reserved",
  "sold",
] as const;

const slugRegex = /^[a-z0-9-]+$/;
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrEmpty = z
  .union([
    z.string().regex(uuidRegex, "Invalid UUID"),
    z.literal(""),
    z.null(),
  ])
  .transform((v) => (v ? v : null))
  .nullable()
  .optional();
const isoDateOrEmpty = z
  .union([z.string().date(), z.literal(""), z.null()])
  .transform((v) => (v ? v : null))
  .nullable()
  .optional();

/** Payment-plan jsonb shape stored on `developments.payment_plan`. */
export const paymentPlanMilestoneSchema = z.object({
  percent: z.number().min(0).max(100),
  label: z.string().min(1).max(80),
  timing: z.string().max(40).optional().default(""),
});

export const paymentPlanSchema = z.object({
  name: z.string().min(1).max(80),
  milestones: z.array(paymentPlanMilestoneSchema).min(1).max(12),
  construction_pct: z.number().min(0).max(100).optional(),
  handover_pct: z.number().min(0).max(100).optional(),
  post_handover_pct: z.number().min(0).max(100).optional(),
  post_handover_months: z.number().int().min(0).max(120).optional(),
});

export type PaymentPlan = z.infer<typeof paymentPlanSchema>;
export type PaymentPlanMilestone = z.infer<typeof paymentPlanMilestoneSchema>;

/** `developments.facts` jsonb shape — eight key/value tiles in the overview. */
export const developmentFactsSchema = z
  .object({
    architecture: z.string().max(80).optional(),
    landscape: z.string().max(80).optional(),
    total_area_ft2: z.string().max(40).optional(),
    lagoon_area_ft2: z.string().max(40).optional(),
    density: z.string().max(40).optional(),
    rera_escrow: z.string().max(80).optional(),
    service_charge_estimate: z.string().max(40).optional(),
    tenure: z.string().max(80).optional(),
  })
  .partial();

export type DevelopmentFacts = z.infer<typeof developmentFactsSchema>;

/** `developments.master_plan.pins[]` — annotations laid over the masterplan image. */
export const masterPlanPinSchema = z.object({
  key: z.string().max(4),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  label: z.string().min(1).max(60),
});

export const masterPlanSchema = z
  .object({
    pins: z.array(masterPlanPinSchema).max(20),
  })
  .partial();

export type MasterPlanPin = z.infer<typeof masterPlanPinSchema>;
export type MasterPlan = z.infer<typeof masterPlanSchema>;

/** Admin edit form schema — single-tab today. */
export const developmentEditSchema = z.object({
  name: z.string().min(3).max(120),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(slugRegex, "Lowercase letters, numbers, and hyphens only"),
  status: z.enum(DEVELOPMENT_STATUSES),
  // developer_id is NOT NULL on the row, so we require it here too.
  developer_id: z.string().regex(uuidRegex, "Pick a developer"),
  area_id: uuidOrEmpty,
  handover_date: isoDateOrEmpty,
  total_units: z.number().int().min(0).max(50_000).nullable().optional(),
  starting_price: z
    .number()
    .min(0)
    .max(1_000_000_000)
    .nullable()
    .optional(),
  tagline: z.string().max(120).nullable().optional(),
  bedrooms_text: z.string().max(40).nullable().optional(),
  description: z.string().max(600).nullable().optional(),
  vision: z.string().max(4000).nullable().optional(),
  escrow_account: z.string().max(80).nullable().optional(),
});

export type DevelopmentEditInput = z.infer<typeof developmentEditSchema>;

const NULLABLE_TEXT_FIELDS = [
  "tagline",
  "bedrooms_text",
  "description",
  "vision",
  "escrow_account",
  "handover_date",
  "area_id",
] as const;

const NULLABLE_NUMBER_FIELDS = ["total_units", "starting_price"] as const;

export function normaliseDevelopmentInput(
  raw: Record<string, unknown>,
): unknown {
  const out: Record<string, unknown> = { ...raw };

  for (const k of NULLABLE_TEXT_FIELDS) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
  }

  for (const k of NULLABLE_NUMBER_FIELDS) {
    const v = out[k];
    if (v === "" || v === undefined || v === null) {
      out[k] = null;
    } else if (typeof v === "string") {
      const n = Number(v);
      out[k] = Number.isNaN(n) ? null : n;
    }
  }

  return out;
}

/** Format AED with K/M suffix — mirror of formatPriceAED for the dev pages. */
export function formatStartingPrice(aed: number | null): string {
  if (aed == null) return "—";
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(1)}M`;
  if (aed >= 1_000) return `AED ${(aed / 1_000).toFixed(0)}K`;
  return `AED ${aed.toLocaleString()}`;
}

/** "2027-12-01" → "Q4 2027". */
export function quarterLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${d.getUTCFullYear()}`;
}

/** Derive cash-flow buckets from the payment plan + a unit price. */
export type PaymentBreakdown = {
  total: number;
  construction: number;
  handover: number;
  postHandover: number;
};

export function computePaymentBreakdown(
  plan: PaymentPlan | null,
  priceAed: number,
): PaymentBreakdown {
  if (!plan || plan.milestones.length === 0) {
    return { total: priceAed, construction: 0, handover: 0, postHandover: 0 };
  }
  // We treat the LAST pre-handover ("Handover") milestone as the handover
  // slice. Everything before it = construction. Everything after = post.
  // The milestone whose `label` contains "Handover" is the divider; if it's
  // missing, we fall back to the plan's explicit percentages.
  let handoverIdx = plan.milestones.findIndex((m) =>
    /handover/i.test(m.label),
  );
  // The first milestone we see called "post" or "year" should NOT be the
  // handover row; if we matched one of those, look for an earlier one.
  if (handoverIdx >= 0 && /post|month|year/i.test(plan.milestones[handoverIdx].label)) {
    const earlier = plan.milestones.findIndex(
      (m, i) => i < handoverIdx && /handover/i.test(m.label),
    );
    if (earlier >= 0) handoverIdx = earlier;
  }

  let constructionPct = 0;
  let handoverPct = 0;
  let postHandoverPct = 0;
  if (handoverIdx >= 0) {
    for (let i = 0; i < plan.milestones.length; i++) {
      const pct = plan.milestones[i].percent;
      if (i < handoverIdx) constructionPct += pct;
      else if (i === handoverIdx) handoverPct += pct;
      else postHandoverPct += pct;
    }
  } else {
    constructionPct = plan.construction_pct ?? 0;
    handoverPct = plan.handover_pct ?? 0;
    postHandoverPct = plan.post_handover_pct ?? 0;
  }

  return {
    total: priceAed,
    construction: round2(priceAed * (constructionPct / 100)),
    handover: round2(priceAed * (handoverPct / 100)),
    postHandover: round2(priceAed * (postHandoverPct / 100)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
