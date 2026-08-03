import { z } from "zod";
import { UUID_SHAPE_RE } from "@/lib/uuid";

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
const uuidOrEmpty = z
  .union([
    z.string().regex(UUID_SHAPE_RE, "Invalid UUID"),
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

/**
 * The four facts the project hero renders as its stat row: starting price,
 * bedrooms, total units and handover.
 *
 * They live on the `developments` row, not in the section document, so the
 * page editor never exposed them — the only place to set them was the record
 * editor, which is a click away and easy to miss. The result was projects
 * created through the "new project" form rendering "—" in all four hero slots
 * with no obvious way to fix it.
 *
 * Required when creating, and required to publish. NOT NOT-NULL in Postgres:
 * a draft is allowed to be incomplete (that is what draft means), and two
 * existing rows predate this. The publish gate is what makes them effectively
 * mandatory on anything the public can see.
 */
export const developmentHeroFactsSchema = z.object({
  starting_price: z
    .number({ error: "Starting price is required" })
    .positive("Starting price must be more than zero")
    .max(1_000_000_000),
  bedrooms_text: z
    .string()
    .trim()
    .min(1, "Bedrooms is required")
    .max(40, "Keep bedrooms under 40 characters"),
  total_units: z
    .number({ error: "Total units is required" })
    .int("Total units must be a whole number")
    .positive("Total units must be more than zero")
    .max(50_000),
  handover_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Handover date is required"),
});

export type DevelopmentHeroFactsInput = z.infer<
  typeof developmentHeroFactsSchema
>;

/**
 * The same four facts, but each one optional.
 *
 * Editing an existing draft is allowed to be partial — someone filling in a
 * project over two sittings should be able to save what they have. Format and
 * range are still enforced on anything actually supplied, so a typo is caught
 * at the point it is made rather than at publish time. Completeness is the
 * publish gate's job, not this one's.
 */
export const developmentHeroFactsPartialSchema = z.object({
  starting_price: z
    .number()
    .positive("Starting price must be more than zero")
    .max(1_000_000_000)
    .nullable(),
  bedrooms_text: z
    .string()
    .trim()
    .max(40, "Keep bedrooms under 40 characters")
    .nullable(),
  total_units: z
    .number()
    .int("Total units must be a whole number")
    .positive("Total units must be more than zero")
    .max(50_000)
    .nullable(),
  handover_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .nullable(),
});

/**
 * Parse a number typed into one of the hero-fact inputs.
 *
 * Returns `null` for genuinely blank, and `NaN` for "they typed something we
 * can't read" — the caller needs to tell those apart, because "required" is
 * the wrong error message for `6.2M`.
 *
 * Thousands separators and a stray AED prefix are stripped rather than
 * rejected: pasting `AED 6,200,000` out of a brochure is the single most
 * likely way this field gets filled, and failing that paste with "Starting
 * price is required" would be actively misleading.
 */
export function parseHeroFactNumber(raw: string): number | null | typeof NaN {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed
    .replace(/^aed\s*/i, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");
  if (cleaned === "" || !/^-?\d*\.?\d+$/.test(cleaned)) return Number.NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
}

export type HeroFactsRow = {
  starting_price: number | null;
  bedrooms_text: string | null;
  total_units: number | null;
  handover_date: string | null;
};

export type HeroFactsGate = {
  ok: boolean;
  blockers: string[];
  checks: { label: string; passed: boolean }[];
};

/**
 * Pre-flight check for the hero stat row, mirroring the shape of
 * `evaluatePublishability` in lib/publishability.ts so the UI can render both
 * the same way.
 *
 * Verified against production before this became a publish gate: all eight
 * published developments already satisfy it, so nothing that is live today is
 * retroactively blocked. Only the two unpublished drafts fail — which is
 * exactly the bug this fixes.
 */
export function evaluateDevelopmentHeroFacts(row: HeroFactsRow): HeroFactsGate {
  const checks: { label: string; passed: boolean }[] = [];
  const blockers: string[] = [];

  const pricePassed =
    typeof row.starting_price === "number" && row.starting_price > 0;
  checks.push({ label: "Starting price is set", passed: pricePassed });
  if (!pricePassed) blockers.push("Starting price is missing");

  const bedsPassed = !!row.bedrooms_text && row.bedrooms_text.trim() !== "";
  checks.push({ label: "Bedrooms is set", passed: bedsPassed });
  if (!bedsPassed) blockers.push("Bedrooms is missing");

  const unitsPassed =
    typeof row.total_units === "number" && row.total_units > 0;
  checks.push({ label: "Total units is set", passed: unitsPassed });
  if (!unitsPassed) blockers.push("Total units is missing");

  const handoverPassed =
    !!row.handover_date && /^\d{4}-\d{2}-\d{2}$/.test(row.handover_date);
  checks.push({ label: "Handover date is set", passed: handoverPassed });
  if (!handoverPassed) blockers.push("Handover date is missing");

  return { ok: blockers.length === 0, blockers, checks };
}

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
  developer_id: z.string().regex(UUID_SHAPE_RE, "Pick a developer"),
  area_id: uuidOrEmpty,
  handover_date: isoDateOrEmpty,
  // `.positive()`, not `.min(0)`. Zero used to be harmless here, but the hero
  // schemas and the publish gate both read zero as "not set" — so a row saved
  // with 0 became unpublishable AND unsaveable from the page editor, which
  // resubmits all four facts together. Three definitions of the same field
  // have to agree on zero, and "a project with 0 units" is not a real project.
  total_units: z.number().int().positive().max(50_000).nullable().optional(),
  starting_price: z
    .number()
    .positive()
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
