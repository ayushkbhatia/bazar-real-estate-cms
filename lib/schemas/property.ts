import { z } from "zod";

export const PROPERTY_MODES = ["buy", "rent", "off_plan", "commercial"] as const;
export const PROPERTY_TYPES = [
  "apartment",
  "villa",
  "penthouse",
  "townhouse",
  "commercial",
  "land",
  "hotel_apartment",
] as const;
export const PROPERTY_STATUSES = [
  "draft",
  "in_review",
  "published",
  "off_market",
  "archived",
] as const;
export const TENURES = ["freehold", "leasehold", "usufruct"] as const;
export const FURNISHINGS = ["unfurnished", "semi", "fully"] as const;

/** Schema for the Overview tab of the property edit form. */
export const propertyOverviewSchema = z.object({
  title: z.string().min(3, "Title is too short").max(160, "Title is too long"),
  short_description: z
    .string()
    .max(320, "Keep it under 320 characters")
    .nullable()
    .optional(),
  type: z.enum(PROPERTY_TYPES),
  mode: z.enum(PROPERTY_MODES),
});

/** Schema for the Pricing tab. */
export const propertyPricingSchema = z.object({
  price_aed: z
    .number({ message: "Price is required" })
    .positive("Price must be positive")
    .max(1_000_000_000, "Price is unrealistically high"),
  service_charge_per_ft2: z
    .number()
    .min(0, "Cannot be negative")
    .max(1_000, "Above 1000 looks wrong")
    .nullable()
    .optional(),
  beds: z
    .number({ message: "Beds is required" })
    .int("Whole number")
    .min(0, "Cannot be negative")
    .max(50, "Above 50 looks wrong"),
  baths: z
    .number({ message: "Baths is required" })
    .int("Whole number")
    .min(0, "Cannot be negative")
    .max(50, "Above 50 looks wrong"),
  built_up_ft2: z
    .number()
    .int("Whole number")
    .positive("Must be positive")
    .nullable()
    .optional(),
  plot_ft2: z
    .number()
    .int("Whole number")
    .positive("Must be positive")
    .nullable()
    .optional(),
});

/** Combined edit schema covering Overview + Pricing tabs. */
export const propertyEditSchema = propertyOverviewSchema.merge(
  propertyPricingSchema,
);

export type PropertyEditInput = z.infer<typeof propertyEditSchema>;

/** Coerce form values into the shape Postgres wants (nulls instead of empty strings). */
export function normaliseEditInput(raw: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = { ...raw };
  for (const key of [
    "short_description",
    "service_charge_per_ft2",
    "built_up_ft2",
    "plot_ft2",
  ] as const) {
    const v = out[key];
    if (v === "" || v === undefined) out[key] = null;
  }
  for (const key of [
    "price_aed",
    "service_charge_per_ft2",
    "beds",
    "baths",
    "built_up_ft2",
    "plot_ft2",
  ] as const) {
    const v = out[key];
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) out[key] = n;
    }
  }
  return out;
}
