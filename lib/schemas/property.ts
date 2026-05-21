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

/** Overview tab. */
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

/** Pricing tab. */
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

/** Details tab — specs + permit + dld. */
export const propertyDetailsSchema = z.object({
  year_built: z
    .number()
    .int("Whole number")
    .min(1900, "Looks too old")
    .max(2100, "Looks too far in the future")
    .nullable()
    .optional(),
  tenure: z.enum(TENURES).nullable().optional(),
  furnishing: z.enum(FURNISHINGS).nullable().optional(),
  view: z.string().max(100).nullable().optional(),
  orientation: z.string().max(80).nullable().optional(),
  parking_bays: z
    .number()
    .int("Whole number")
    .min(0, "Cannot be negative")
    .max(50)
    .nullable()
    .optional(),
  floor: z
    .number()
    .int("Whole number")
    .min(-10)
    .max(200)
    .nullable()
    .optional(),
  address_line: z.string().max(200).nullable().optional(),
  listing_permit_no: z.string().max(80).nullable().optional(),
  listing_permit_expires_at: isoDateOrEmpty,
  dld_plot_number: z.string().max(80).nullable().optional(),
});

/** Location tab — area picker. Sub-community + building come in 1.1d+ once
 *  the area tree picker is built. */
export const propertyLocationSchema = z.object({
  area_id: uuidOrEmpty,
});

/** Amenities tab — free-form chip list capped at 50 entries. */
export const propertyAmenitiesSchema = z.object({
  amenities: z
    .array(z.string().min(1).max(50))
    .max(50, "Maximum 50 amenities"),
});

/** SEO tab — slug + meta. Slug also lives on the row top-level. */
export const propertySeoSchema = z.object({
  slug: z
    .string()
    .min(3, "Slug is too short")
    .max(120, "Slug is too long")
    .regex(slugRegex, "Lowercase letters, numbers, and hyphens only"),
  meta_title: z.string().max(70).nullable().optional(),
  meta_description: z.string().max(180).nullable().optional(),
});

/** Combined edit schema covering all six tabs. */
export const propertyEditSchema = propertyOverviewSchema
  .merge(propertyPricingSchema)
  .merge(propertyDetailsSchema)
  .merge(propertyLocationSchema)
  .merge(propertyAmenitiesSchema)
  .merge(propertySeoSchema);

export type PropertyEditInput = z.infer<typeof propertyEditSchema>;

/** Minimal payload for creating a new property — fields the staff member
 *  fills in the "New property" sheet. The rest is filled with defaults. */
export const propertyCreateSchema = z.object({
  title: z.string().min(3, "Title is too short").max(160, "Title is too long"),
  type: z.enum(PROPERTY_TYPES),
  mode: z.enum(PROPERTY_MODES),
  price_aed: z
    .number({ message: "Price is required" })
    .positive("Price must be positive")
    .max(1_000_000_000),
  beds: z.number().int().min(0).max(50),
  baths: z.number().int().min(0).max(50),
});

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;

/** Coerce form values into the shape Postgres wants:
 *   - empty-string nullable fields → null
 *   - numeric strings → numbers (where the column is numeric)
 *   - amenities CSV string (from textarea) → string[]
 */
const NULLABLE_TEXT_FIELDS = [
  "short_description",
  "view",
  "orientation",
  "address_line",
  "listing_permit_no",
  "listing_permit_expires_at",
  "dld_plot_number",
  "tenure",
  "furnishing",
  "area_id",
  "meta_title",
  "meta_description",
] as const;

const NULLABLE_NUMBER_FIELDS = [
  "service_charge_per_ft2",
  "built_up_ft2",
  "plot_ft2",
  "year_built",
  "parking_bays",
  "floor",
] as const;

const REQUIRED_NUMBER_FIELDS = ["price_aed", "beds", "baths"] as const;

export function normaliseEditInput(raw: Record<string, unknown>): unknown {
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

  for (const k of REQUIRED_NUMBER_FIELDS) {
    const v = out[k];
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) out[k] = n;
    }
  }

  if (typeof out.amenities === "string") {
    out.amenities = (out.amenities as string)
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (!Array.isArray(out.amenities)) {
    out.amenities = [];
  }

  return out;
}
