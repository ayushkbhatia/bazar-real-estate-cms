import { z } from "zod";
import { uuidLike } from "@/lib/uuid";

/**
 * The parts of a development that live on the record rather than in its page
 * document: the payment plan, the named-feature blocks, the map pin, the
 * neighbouring projects, the FAQs and the lead advisor.
 *
 * They're on the record because the public page, the developments admin and
 * the search surfaces all read them there — a section document would be a
 * second copy of the same fact.
 */

export const milestoneSchema = z.object({
  label: z.string().min(1, "Give the stage a name").max(60),
  label_ar: z.string().max(60).nullable().optional(),
  timing: z.string().max(60).nullable().optional(),
  timing_ar: z.string().max(60).nullable().optional(),
  percent: z
    .number({ message: "Percent is required" })
    .min(0, "Can't be negative")
    .max(100, "Can't exceed 100"),
});

export type PaymentMilestone = z.infer<typeof milestoneSchema>;

export const paymentPlanSchema = z.object({
  name: z.string().min(2, "Name the plan").max(60),
  name_ar: z.string().max(60).nullable().optional(),
  milestones: z.array(milestoneSchema).min(1, "Add at least one stage").max(12),
  construction_pct: z.number().min(0).max(100).nullable().optional(),
  handover_pct: z.number().min(0).max(100).nullable().optional(),
  post_handover_pct: z.number().min(0).max(100).nullable().optional(),
  post_handover_months: z.number().int().min(0).max(120).nullable().optional(),
});

export type PaymentPlan = z.infer<typeof paymentPlanSchema>;

export const featureBlockSchema = z.object({
  key: z.string().min(1).max(40),
  title: z.string().min(1, "Give the feature a title").max(80),
  copy: z.string().min(1, "Write a line or two").max(600),
  /*
   * The Arabic twins, beside their siblings inside the bag — the rule
   * docs/I18N.md states for every jsonb value, and the same shape the unit
   * types and floor plans on this record already use (`label_ar`, `blurb_ar`).
   *
   * Optional and nullable because 93 blocks were written before these existed.
   * A blank twin is not a blank page: `localiseFeatureBlocks` falls through to
   * the Arabic store, so the machine first draft (ADR-0008) renders until
   * somebody types over it here — and what they type wins from that moment.
   */
  title_ar: z.string().max(80).nullable().optional(),
  copy_ar: z.string().max(600).nullable().optional(),
  /** Media asset id, resolved to a URL when the page renders. */
  media_id: z.string().nullable().optional(),
  alt: z.string().max(160).nullable().optional(),
});

export type FeatureBlock = z.infer<typeof featureBlockSchema>;

export const faqEntrySchema = z.object({
  q: z.string().min(1, "Ask the question").max(200),
  a: z.string().min(1, "Answer it").max(1200),
  /** Same contract as the feature blocks above: typed twin, store, English. */
  q_ar: z.string().max(200).nullable().optional(),
  a_ar: z.string().max(1200).nullable().optional(),
});

export const developmentContentSchema = z.object({
  payment_plan: paymentPlanSchema.nullable(),
  feature_blocks: z.array(featureBlockSchema).max(8),
  faq: z.array(faqEntrySchema).max(12),
  coords: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable(),
  /** Up to three sibling projects, in display order. Mirrors the design. */
  nearby_ids: z.array(uuidLike()).max(3),
  lead_advisor_id: uuidLike().nullable(),
});

export type DevelopmentContentInput = z.infer<typeof developmentContentSchema>;

/** Milestones should total 100%. Surfaced as a warning, not a hard block —
 *  a plan can be mid-edit, and some developers publish partial schedules. */
export function milestoneTotal(milestones: { percent?: number }[]): number {
  return milestones.reduce((sum, m) => sum + (m.percent ?? 0), 0);
}

export function blankMilestone(): PaymentMilestone {
  return { label: "", label_ar: null, timing: null, timing_ar: null, percent: 0 };
}

export function blankFeature(index: number): FeatureBlock {
  return {
    key: `feature_${index + 1}`,
    title: "",
    copy: "",
    title_ar: null,
    copy_ar: null,
    media_id: null,
    alt: null,
  };
}
