import { z } from "zod";
import { UUID_SHAPE_RE } from "@/lib/uuid";


export const ENQUIRY_SOURCES = [
  "property_page",
  "contact_page",
  "concierge",
  "valuation",
  "mortgage",
  "blog_cta",
  "agent_page",
  "share_with_advisor",
  "whatsapp_inbound",
  // Brochure request from a development page (0066).
  "brochure",
  // "Register your interest" on a development hero (0075).
  "development_interest",
  // Owner lead from the /services/sell qualification form (0077).
  "list_property",
] as const;

export const ENQUIRY_TIMELINES = [
  "now",
  "three_months",
  "six_months",
  "twelve_months",
  "browsing",
] as const;

export const ENQUIRY_INTENTS = [
  "buy",
  "sell",
  "rent",
  "invest",
  "manage",
] as const;

/**
 * No `.transform()` / `.preprocess()` here — keep INPUT and OUTPUT types
 * aligned so `useForm<EnquiryInput>` + zodResolver type-check. All
 * coercion lives in normaliseEnquiryInput.
 */
export const enquirySchema = z
  .object({
    name: z.string().min(2, "Name is too short").max(120, "Name is too long"),
    email: z
      .union([z.string().email("Enter a valid email"), z.literal("")])
      .optional(),
    phone: z
      .union([
        z
          .string()
          .min(5, "Phone is too short")
          .max(32, "Phone is too long"),
        z.literal(""),
      ])
      .optional(),
    message: z
      .string()
      .min(2, "Tell us a bit more")
      .max(2000, "Trim it to under 2000 characters"),
    timeline: z.enum(ENQUIRY_TIMELINES).nullable().optional(),
    budget_min: z.number().int().min(0).nullable().optional(),
    budget_max: z.number().int().min(0).nullable().optional(),
    source: z.enum(ENQUIRY_SOURCES),
    property_id: z
      .string()
      .regex(UUID_SHAPE_RE, "Invalid UUID")
      .nullable()
      .optional(),
    development_id: z
      .string()
      .regex(UUID_SHAPE_RE, "Invalid UUID")
      .nullable()
      .optional(),
    intent: z.enum(ENQUIRY_INTENTS).nullable().optional(),
  })
  .refine((v) => (v.email && v.email.length > 0) || (v.phone && v.phone.length > 0), {
    message: "We need at least an email or a phone number",
    path: ["email"],
  })
  .refine(
    (v) =>
      v.budget_min == null ||
      v.budget_max == null ||
      v.budget_min <= v.budget_max,
    {
      message: "Min budget can't exceed max",
      path: ["budget_min"],
    },
  );

export type EnquiryInput = z.infer<typeof enquirySchema>;

/**
 * Pre-validation coercion:
 *   - blank strings → null on optional nullable fields
 *   - numeric strings → ints on budget fields
 *   - trim strings; lowercase email
 *
 * Returns an unknown — the caller should run it through zod for the typed shape.
 */
export function normaliseEnquiryInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  for (const k of ["budget_min", "budget_max"] as const) {
    const v = out[k];
    if (v === "" || v === undefined || v === null) {
      out[k] = null;
    } else if (typeof v === "string") {
      const n = Number(v);
      out[k] = Number.isNaN(n) ? null : Math.trunc(n);
    }
  }

  for (const k of [
    "timeline",
    "property_id",
    "development_id",
    "intent",
  ] as const) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
  }

  for (const k of ["name", "message", "email", "phone"] as const) {
    const v = out[k];
    if (typeof v === "string") {
      let trimmed = v.trim();
      if (k === "email") trimmed = trimmed.toLowerCase();
      out[k] = trimmed;
    }
  }

  return out;
}
