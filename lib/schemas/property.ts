import { z } from "zod";
import { UUID_SHAPE_RE } from "@/lib/uuid";
import { normaliseAmenityList } from "@/lib/amenities";

export const PROPERTY_MODES = ["buy", "rent", "off_plan", "commercial"] as const;
export type PropertyMode = (typeof PROPERTY_MODES)[number];

/** Single source of truth for mode labels — both the create sheet and the
 *  property editor read this instead of keeping their own copies. */
export const PROPERTY_MODE_LABELS: Record<PropertyMode, string> = {
  buy: "For sale",
  rent: "For rent",
  off_plan: "Off-plan",
  commercial: "Commercial",
};

/** Property form — the *provenance* of a sale listing.
 *
 *  The Postgres enum `public.property_form` also carries 'off_plan', but that
 *  value is deliberately NOT offered here: off-plan is already expressed by
 *  `mode = 'off_plan'`, and two writable spellings of one concept is a trap.
 *  So the only selectable forms are the two that describe ownership history.
 */
export const PROPERTY_FORMS = ["ready_new", "resale"] as const;
export type PropertyForm = (typeof PROPERTY_FORMS)[number];

export const PROPERTY_FORM_LABELS: Record<PropertyForm, string> = {
  ready_new: "Ready (new)",
  resale: "Resale",
};

/** Operator-facing one-liners. "Ready (new)" is about never-having-been-owned,
 *  not about the building being recently finished — say so in the UI. */
export const PROPERTY_FORM_HINTS: Record<PropertyForm, string> = {
  ready_new:
    "Completed and sold directly by the developer — never previously owned. Not about how recently it was built.",
  resale: "Previously owned; being sold on by the current owner.",
};

/** Shown under the picker before anything is chosen. */
export const PROPERTY_FORM_HELP =
  "How this home is coming to market. Ready (new): the developer's first sale, never previously owned. Resale: previously owned.";

/** Modes that may carry a property form. Rent must not: the DB CHECK
 *  `properties_form_rent_null_ck` rejects a rent row with a non-null form,
 *  and off-plan says the same thing through `mode` already. */
const SALE_MODES: readonly PropertyMode[] = ["buy", "commercial"];

export function isSaleMode(mode: string | null | undefined): boolean {
  return SALE_MODES.includes(mode as PropertyMode);
}

/** Narrow any stored/loaded value to a form the pickers can actually show.
 *  'off_plan', unknown strings, and empty strings all collapse to null. */
export function toSelectableForm(
  value: string | null | undefined,
): PropertyForm | null {
  return PROPERTY_FORMS.includes(value as PropertyForm)
    ? (value as PropertyForm)
    : null;
}

/** What the form value must become for a given mode — null outside sale
 *  modes. Used by the pickers when the operator switches mode, so we never
 *  submit a combination the DB constraint would reject. */
export function formForMode(
  mode: string | null | undefined,
  form: string | null | undefined,
): PropertyForm | null {
  return isSaleMode(mode) ? toSelectableForm(form) : null;
}

export const PROPERTY_TYPES = [
  "apartment",
  "villa",
  "penthouse",
  "townhouse",
  "commercial",
  "land",
  "hotel_apartment",
  "office",
  "building",
  "retail",
  "commercial_villa",
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
const uuidOrEmpty = z
  .union([
    z.string().regex(UUID_SHAPE_RE, "Invalid UUID"),
    z.literal(""),
    z.null(),
  ])
  .transform((v) => (v ? v : null))
  .nullable()
  .optional();
/** No `""` member and no transform on purpose: keeping the input and output
 *  types identical is what lets `zodResolver` type-check against
 *  `PropertyEditInput` / `PropertyCreateInput`. Blank strings are folded to
 *  null by the normalisers before they ever reach the schema. */
const propertyFormField = z
  .enum(PROPERTY_FORMS, { message: "Pick Ready (new) or Resale" })
  .nullable()
  .optional();
const isoDateOrEmpty = z
  .union([z.string().date(), z.literal(""), z.null()])
  .transform((v) => (v ? v : null))
  .nullable()
  .optional();

/** Overview tab. Sprint 8 adds bazar_verified + advisor_note +
 *  featured_on_homepage so the property editor's overview form persists
 *  the Bazar Verified badge, the Mariam's-voice contextual note, and
 *  the homepage feature toggle.
 *
 *  All three are optional in the schema so existing callsites (pages
 *  loading `initial` values, the action that constructs update objects)
 *  compile without changes. Migration 0020 defaults them to
 *  false/null at the database layer. */
const propertyOverviewFields = z.object({
  title: z.string().min(3, "Title is too short").max(160, "Title is too long"),
  short_description: z
    .string()
    .max(320, "Keep it under 320 characters")
    .nullable()
    .optional(),
  /* Arabic twins. Optional and nullable in every case — blank falls back to
   * the English in place, which is the site-wide rule, so a missing
   * translation must never be a validation error.
   *
   * The caps are 1.5x their English siblings, matching `arMax` in the master
   * pages. Arabic runs longer than English for the same content often enough
   * that the English cap rejects a correct translation, and a rejected
   * translation is a field that silently stays English. */
  title_ar: z
    .string()
    .max(240, "Keep the Arabic title under 240 characters")
    .nullable()
    .optional(),
  short_description_ar: z
    .string()
    .max(480, "Keep the Arabic summary under 480 characters")
    .nullable()
    .optional(),
  type: z.enum(PROPERTY_TYPES),
  mode: z.enum(PROPERTY_MODES),
  // Developer is a required section of the listing wizard. The column is
  // nullable at the DB layer (a fresh "create draft" has none), so we enforce
  // requiredness here — mirroring developmentEditSchema's developer_id.
  developer_id: z.string().regex(UUID_SHAPE_RE, "Pick a developer"),
  bazar_verified: z.boolean().optional(),
  advisor_note: z
    .string()
    .max(560, "Keep the advisor note under 560 characters")
    .nullable()
    .optional(),
  featured_on_homepage: z.boolean().optional(),
  /** Sale-listing provenance. Null for rent (DB CHECK) and for anything the
   *  lister hasn't classified yet. */
  property_form: propertyFormField,
});

/** Shared rule, applied to every schema that carries both `mode` and
 *  `property_form`: rent listings must not carry a form. Mirrors the DB CHECK
 *  `properties_form_rent_null_ck`, so an operator sees a field error instead
 *  of a raw Postgres 23514. */
function refineRentHasNoForm(
  val: { mode?: string | null; property_form?: string | null },
  ctx: z.RefinementCtx,
) {
  if (val.mode === "rent" && val.property_form != null) {
    ctx.addIssue({
      code: "custom",
      path: ["property_form"],
      message: "Rent listings cannot have a property form.",
    });
  }
}

export const propertyOverviewSchema =
  propertyOverviewFields.superRefine(refineRentHasNoForm);

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

/** Compliance jsonb checkboxes. Required before publish. */
export const propertyComplianceSchema = z.object({
  form_a: z.boolean(),
  title_deed: z.boolean(),
  noc: z.boolean(),
  power_of_attorney: z.boolean(),
});

export type PropertyCompliance = z.infer<typeof propertyComplianceSchema>;

export const COMPLIANCE_LABELS: Record<keyof PropertyCompliance, string> = {
  form_a: "Form A signed",
  title_deed: "Title deed verified",
  noc: "NOC obtained",
  power_of_attorney: "Power of Attorney (if applicable)",
};

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

/** Combined edit schema covering all six tabs.
 *  Compliance lives in PublishCard with its own immediate-save UI; it is
 *  not part of this form.
 */
export const propertyEditSchema = propertyOverviewFields
  .merge(propertyPricingSchema)
  .merge(propertyDetailsSchema)
  .merge(propertyLocationSchema)
  .merge(propertyAmenitiesSchema)
  .merge(propertySeoSchema)
  .superRefine(refineRentHasNoForm);

export type PropertyEditInput = z.infer<typeof propertyEditSchema>;

/** Minimal payload for creating a new property — fields the staff member
 *  fills in the "New property" sheet. The rest is filled with defaults. */
export const propertyCreateSchema = z
  .object({
    title: z.string().min(3, "Title is too short").max(160, "Title is too long"),
    type: z.enum(PROPERTY_TYPES),
    mode: z.enum(PROPERTY_MODES),
    price_aed: z
      .number({ message: "Price is required" })
      .positive("Price must be positive")
      .max(1_000_000_000),
    beds: z.number().int().min(0).max(50),
    baths: z.number().int().min(0).max(50),
    property_form: propertyFormField,
  })
  .superRefine(refineRentHasNoForm);

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;

/** Coerce form values into the shape Postgres wants:
 *   - empty-string nullable fields → null
 *   - numeric strings → numbers (where the column is numeric)
 *   - amenities CSV string (from textarea) → string[]
 */
const NULLABLE_TEXT_FIELDS = [
  "short_description",
  // Without these two the editor's empty Arabic box submits "" and Postgres
  // stores an empty string rather than NULL — which reads as "translated to
  // nothing" everywhere downstream instead of "not translated".
  "title_ar",
  "short_description_ar",
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
  "advisor_note",
  "property_form",
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

  // Amenities can arrive as CSV (import), or as the array the picker writes.
  // Either way the server tidies and de-duplicates rather than trusting the
  // client — the picker now lets a lister type a custom value. Over-length
  // entries are left intact so the schema reports them instead of truncating.
  if (typeof out.amenities === "string") {
    out.amenities = normaliseAmenityList((out.amenities as string).split(/[,\n]/));
  } else if (Array.isArray(out.amenities)) {
    out.amenities = normaliseAmenityList(
      (out.amenities as unknown[]).filter((v): v is string => typeof v === "string"),
    );
  } else {
    out.amenities = [];
  }

  // Sprint 8 — boolean flags: coerce "on"/"true"/checkbox strings to bools.
  for (const k of ["bazar_verified", "featured_on_homepage"] as const) {
    const v = out[k];
    if (typeof v === "string") {
      out[k] = v === "on" || v === "true" || v === "1";
    } else if (v === undefined || v === null) {
      out[k] = false;
    }
  }

  return out;
}

/** Read a `compliance` jsonb blob, filling in defaults for absent flags. */
export function normaliseCompliance(
  raw: Record<string, unknown> | null | undefined,
): PropertyCompliance {
  const incoming = raw ?? {};
  return {
    form_a: Boolean(incoming.form_a),
    title_deed: Boolean(incoming.title_deed),
    noc: Boolean(incoming.noc),
    power_of_attorney: Boolean(incoming.power_of_attorney),
  };
}
