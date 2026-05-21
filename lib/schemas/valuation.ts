import { z } from "zod";
import { PROPERTY_TYPES, FURNISHINGS } from "@/lib/schemas/property";

export const VALUATION_CONDITIONS = [
  "original",
  "lightly_refreshed",
  "renovated",
  "fully_renovated",
] as const;

export const VALUATION_TENANCIES = [
  "vacant",
  "rented_le_6mo",
  "rented_gt_6mo",
] as const;

export const VALUATION_MORTGAGE_STATES = ["no", "yes_partial"] as const;

export const UPGRADE_OPTIONS = [
  "Designer kitchen (Boffi / Poliform / etc.)",
  "Marble or stone flooring",
  "Smart home wiring",
  "Extended primary suite / dressing room",
  "Custom joinery / built-ins",
  "AV / cinema room",
  "Pool or outdoor terrace upgrades",
  "Bathroom remodels",
] as const;

export const VIEW_OPTIONS = [
  "Sea / waterfront",
  "Skyline / city",
  "Park / garden",
  "Community / pool",
  "Partial sea",
] as const;

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidOrEmpty = z
  .union([z.string().regex(uuidRegex, "Invalid area"), z.literal("")])
  .nullable()
  .optional();

/** Step 1 — property location. The owner picks the area; everything else
 *  is free-text so we don't trip on Bazar-area edge cases. */
export const valuationStep1Schema = z.object({
  area_id: uuidOrEmpty,
  address_line: z.string().max(200).optional().default(""),
  building_name: z.string().max(120).optional().default(""),
  unit_number: z.string().max(40).optional().default(""),
});

/** Step 2 — specifications. */
export const valuationStep2Schema = z.object({
  property_type: z.enum(PROPERTY_TYPES),
  beds: z
    .number({ message: "Beds is required" })
    .int("Whole number")
    .min(0)
    .max(50),
  baths: z
    .number({ message: "Baths is required" })
    .int("Whole number")
    .min(0)
    .max(50),
  built_up_ft2: z
    .number({ message: "Area is required" })
    .int("Whole number")
    .min(100, "Looks too small")
    .max(200_000, "Looks too big"),
  floor: z
    .union([z.number().int().min(-10).max(200), z.null()])
    .optional(),
});

/** Step 3 — condition & upgrades. */
export const valuationStep3Schema = z.object({
  condition: z.enum(VALUATION_CONDITIONS).nullable().optional(),
  upgrades: z.array(z.enum(UPGRADE_OPTIONS)).max(UPGRADE_OPTIONS.length).default([]),
  furnishing: z.enum(FURNISHINGS).nullable().optional(),
  view_description: z.string().max(120).nullable().optional(),
  tenancy: z.enum(VALUATION_TENANCIES).nullable().optional(),
  mortgage_state: z.enum(VALUATION_MORTGAGE_STATES).nullable().optional(),
});

/** Step 4 — about you. */
export const valuationStep4Schema = z
  .object({
    owner_name: z.string().min(2, "Name is too short").max(120),
    owner_email: z.string().email("Enter a valid email"),
    owner_phone: z
      .union([
        z.string().min(5, "Phone is too short").max(32),
        z.literal(""),
      ])
      .optional(),
    marketing_opt_in: z.boolean().default(false),
  })
  .refine((v) => v.owner_email.length > 0, {
    message: "Email is required",
    path: ["owner_email"],
  });

export const valuationSubmissionSchema = valuationStep1Schema
  .merge(valuationStep2Schema)
  .merge(valuationStep3Schema)
  .merge(valuationStep4Schema);

export type ValuationSubmission = z.infer<typeof valuationSubmissionSchema>;

/** Coerce a Record into the wire payload — used by the server action. */
export function normaliseValuationInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  for (const k of [
    "beds",
    "baths",
    "built_up_ft2",
    "floor",
  ] as const) {
    const v = out[k];
    if (v === "" || v === undefined || v === null) {
      out[k] = k === "floor" ? null : v;
    } else if (typeof v === "string") {
      const cleaned = v.replace(/[^0-9.-]/g, "");
      const n = Number(cleaned);
      out[k] = Number.isNaN(n) ? null : Math.trunc(n);
    }
  }

  if (out.upgrades === undefined || out.upgrades === null) out.upgrades = [];
  if (typeof out.upgrades === "string") {
    out.upgrades = (out.upgrades as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  for (const k of [
    "condition",
    "furnishing",
    "view_description",
    "tenancy",
    "mortgage_state",
    "area_id",
  ] as const) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
  }

  if (typeof out.marketing_opt_in === "string") {
    out.marketing_opt_in =
      out.marketing_opt_in === "true" || out.marketing_opt_in === "on";
  }

  for (const k of [
    "owner_name",
    "owner_email",
    "owner_phone",
    "address_line",
    "building_name",
    "unit_number",
    "view_description",
  ] as const) {
    const v = out[k];
    if (typeof v === "string") {
      const trimmed = v.trim();
      out[k] = k === "owner_email" ? trimmed.toLowerCase() : trimmed;
    }
  }

  return out;
}
