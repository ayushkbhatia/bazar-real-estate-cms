/**
 * The /services/sell owner lead — "list a property".
 *
 * One schema, validated on the client (react-hook-form via zodResolver) and
 * again on the server action, so a hand-rolled POST can't skip the rules.
 *
 * Everything here is UI-facing vocabulary rather than DB vocabulary: the
 * property taxonomy on this form is a qualification aid, not the `properties`
 * taxonomy, and the answers land in `enquiries.inferred_constraints` rather
 * than in typed columns. `toEnquiryTimeline` / `toEnquiryIntent` map the two
 * answers that *do* have a column across.
 */
import { z } from "zod";
import type { ENQUIRY_INTENTS, ENQUIRY_TIMELINES } from "./enquiry";

export const LP_INTENTS = ["sell", "rent_out"] as const;
export type LpIntent = (typeof LP_INTENTS)[number];

export const LP_CATEGORIES = ["residential", "commercial"] as const;
export type LpCategory = (typeof LP_CATEGORIES)[number];

export const LP_TYPES: Record<LpCategory, readonly string[]> = {
  residential: [
    "Apartment",
    "Villa",
    "Townhouse",
    "Penthouse",
    "Land",
    "Other",
  ],
  commercial: [
    "Office",
    "Retail",
    "Warehouse",
    "Showroom",
    "Full building",
    "Plot",
  ],
};

/** Types that carry no bedroom count, so the field is hidden for them. */
export const LP_TYPES_WITHOUT_BEDROOMS = ["Land", "Other"] as const;

export const LP_BEDROOMS = [
  "Studio",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8+",
] as const;

export const LP_FURNISHINGS = [
  "unfurnished",
  "semi_furnished",
  "fully_furnished",
] as const;
export type LpFurnishing = (typeof LP_FURNISHINGS)[number];

export const LP_URGENCIES = ["this_month", "two_months", "flexible"] as const;
export type LpUrgency = (typeof LP_URGENCIES)[number];

export const LP_CALL_WINDOWS = ["morning", "afternoon", "evening"] as const;
export type LpCallWindow = (typeof LP_CALL_WINDOWS)[number];

export const LP_INTENT_LABELS: Record<LpIntent, string> = {
  sell: "Sell",
  rent_out: "Rent out",
};

export const LP_CATEGORY_LABELS: Record<LpCategory, string> = {
  residential: "Residential",
  commercial: "Commercial",
};

export const LP_FURNISHING_LABELS: Record<LpFurnishing, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  fully_furnished: "Fully furnished",
};

export const LP_URGENCY_LABELS: Record<LpUrgency, string> = {
  this_month: "This month",
  two_months: "Within 2 months",
  flexible: "Flexible",
};

export const LP_CALL_WINDOW_LABELS: Record<LpCallWindow, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/** What the confirmation promises — "Mariam will call you this morning." */
export const LP_CALL_WINDOW_PHRASES: Record<LpCallWindow, string> = {
  morning: "tomorrow morning",
  afternoon: "this afternoon",
  evening: "this evening",
};

/**
 * UAE mobile, entered without the +971 the field already shows. Accepts the
 * spacing owners actually type ("50 123 4567", "050-1234567") and the leading
 * zero from a local-format number, then checks the national 9-digit shape:
 * a 5-prefixed mobile, or a 2/3/4/6/7-prefixed landline of 8 digits.
 */
export function normaliseUaeMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "").replace(/^00971/, "").replace(/^971/, "");
  const national = digits.replace(/^0+/, "");
  if (/^5\d{8}$/.test(national)) return `+971${national}`;
  if (/^[2-46-7]\d{7}$/.test(national)) return `+971${national}`;
  return null;
}

/** "1,450" / "1450 " → 1450. Returns null when there's no usable number. */
export function parseAreaSqft(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

const AREA_MIN_SQFT = 100;
const AREA_MAX_SQFT = 2_000_000;

/**
 * Step 1 fields. Split out from the full schema so the client can gate the
 * "Continue" button on exactly the rules the server will apply to step 1,
 * with no second definition of "ready".
 */
export const listPropertyStep1Schema = z
  .object({
    intent: z.enum(LP_INTENTS),
    location: z
      .string()
      .trim()
      .min(2, "Tell us where the property is")
      .max(160, "That's too long for a location"),
    /** Set when the owner picked a suggestion; drives advisor routing. */
    area_slug: z.string().trim().max(120).nullable().optional(),
    category: z.enum(LP_CATEGORIES),
    property_type: z.string().trim().min(1, "Pick a property type").max(60),
    bedrooms: z.string().trim().max(10).nullable().optional(),
    area_sqft: z
      .number()
      .int()
      .min(AREA_MIN_SQFT, `Area looks too small — ${AREA_MIN_SQFT} ft² is the minimum`)
      .max(AREA_MAX_SQFT, "That area looks too large — check the figure")
      .nullable()
      .optional(),
    furnishing: z.enum(LP_FURNISHINGS).nullable().optional(),
    urgency: z.enum(LP_URGENCIES).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!LP_TYPES[v.category].includes(v.property_type)) {
      ctx.addIssue({
        code: "custom",
        path: ["property_type"],
        message: "Pick a property type",
      });
      return;
    }
    if (bedroomsApply(v.category, v.property_type) && !v.bedrooms) {
      ctx.addIssue({
        code: "custom",
        path: ["bedrooms"],
        message: "Pick a bedroom count",
      });
    }
    if (
      v.bedrooms &&
      !(LP_BEDROOMS as readonly string[]).includes(v.bedrooms)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["bedrooms"],
        message: "Pick a bedroom count",
      });
    }
  });

export const listPropertySchema = z
  .object({
    intent: z.enum(LP_INTENTS),
    location: z
      .string()
      .trim()
      .min(2, "Tell us where the property is")
      .max(160, "That's too long for a location"),
    area_slug: z.string().trim().max(120).nullable().optional(),
    category: z.enum(LP_CATEGORIES),
    property_type: z.string().trim().min(1, "Pick a property type").max(60),
    bedrooms: z.string().trim().max(10).nullable().optional(),
    area_sqft: z
      .number()
      .int()
      .min(AREA_MIN_SQFT, `Area looks too small — ${AREA_MIN_SQFT} ft² is the minimum`)
      .max(AREA_MAX_SQFT, "That area looks too large — check the figure")
      .nullable()
      .optional(),
    furnishing: z.enum(LP_FURNISHINGS).nullable().optional(),
    urgency: z.enum(LP_URGENCIES).nullable().optional(),

    name: z
      .string()
      .trim()
      .min(2, "Tell us who to ask for")
      .max(120, "That name is too long"),
    /** National format as typed; the server stores the +971 form. */
    mobile: z
      .string()
      .trim()
      .min(1, "We need a mobile number")
      .refine((v) => normaliseUaeMobile(v) !== null, "Enter a UAE number, e.g. 50 123 4567"),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    call_window: z.enum(LP_CALL_WINDOWS),
    consent: z
      .boolean()
      .refine((v) => v === true, "We need your consent to call you"),
  })
  .superRefine((v, ctx) => {
    if (!LP_TYPES[v.category].includes(v.property_type)) {
      ctx.addIssue({
        code: "custom",
        path: ["property_type"],
        message: "Pick a property type",
      });
      return;
    }
    if (bedroomsApply(v.category, v.property_type) && !v.bedrooms) {
      ctx.addIssue({
        code: "custom",
        path: ["bedrooms"],
        message: "Pick a bedroom count",
      });
    }
    if (
      v.bedrooms &&
      !(LP_BEDROOMS as readonly string[]).includes(v.bedrooms)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["bedrooms"],
        message: "Pick a bedroom count",
      });
    }
  });

export type ListPropertyInput = z.infer<typeof listPropertySchema>;

/** Bedrooms are a residential question, and not one for land or "other". */
export function bedroomsApply(
  category: LpCategory,
  propertyType: string | null | undefined,
): boolean {
  if (category !== "residential" || !propertyType) return false;
  return !(LP_TYPES_WITHOUT_BEDROOMS as readonly string[]).includes(
    propertyType,
  );
}

export function formatBedrooms(bedrooms: string): string {
  return bedrooms === "Studio" ? "Studio" : `${bedrooms} bed`;
}

export function formatSqft(sqft: number): string {
  return `${sqft.toLocaleString("en-GB")} ft²`;
}

type SummaryInput = {
  intent: LpIntent;
  location: string;
  category: LpCategory;
  property_type: string;
  bedrooms?: string | null;
  area_sqft?: number | null;
};

/**
 * The one-line brief shown on the step-2 chip, on the confirmation, and in the
 * enquiry the desk works: "For sale · Saadiyat Island · Apartment · 2 bed".
 */
export function buildSummary(input: SummaryInput): string {
  const beds = bedroomsApply(input.category, input.property_type)
    ? input.bedrooms
    : null;
  return [
    input.intent === "sell" ? "For sale" : "To rent out",
    input.location.trim(),
    input.property_type,
    beds ? formatBedrooms(beds) : null,
    input.area_sqft ? formatSqft(input.area_sqft) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * What the advisor reads in the enquiry thread. `brief_raw` is the body of the
 * first message the `on_enquiry_created` trigger writes, so this is the lead as
 * the desk first sees it — keep it scannable and complete.
 */
export function buildBrief(
  input: ListPropertyInput & { reference: string },
): string {
  const lines: string[] = [
    `Owner lead · ${input.intent === "sell" ? "wants to sell" : "wants to rent out"}`,
    `Reference: ${input.reference}`,
    "",
    `Location: ${input.location.trim()}`,
    `Category: ${LP_CATEGORY_LABELS[input.category]} · ${input.property_type}`,
  ];
  if (bedroomsApply(input.category, input.property_type) && input.bedrooms) {
    lines.push(`Bedrooms: ${formatBedrooms(input.bedrooms)}`);
  }
  if (input.area_sqft) lines.push(`Built-up area: ${formatSqft(input.area_sqft)}`);
  if (input.furnishing)
    lines.push(`Furnishing: ${LP_FURNISHING_LABELS[input.furnishing]}`);
  if (input.urgency)
    lines.push(
      `${input.intent === "sell" ? "Wants to sell" : "Wants it let"}: ${LP_URGENCY_LABELS[input.urgency]}`,
    );
  lines.push(
    `Best time to call: ${LP_CALL_WINDOW_LABELS[input.call_window]}`,
    "",
    "Consented to contact by phone, WhatsApp and email.",
  );
  return lines.join("\n");
}

/**
 * `BZ-SL-48210` / `BZ-RL-48210`. Derived from the enquiry id so it is stable,
 * unique in practice, and needs no counter — the owner quotes it, and the desk
 * finds the lead by it because the brief carries the same string.
 */
export function buildReference(enquiryId: string, intent: LpIntent): string {
  const hex = enquiryId.replace(/[^0-9a-f]/gi, "").slice(0, 8) || "0";
  const n = parseInt(hex, 16) % 100000;
  return `BZ-${intent === "sell" ? "SL" : "RL"}-${String(n).padStart(5, "0")}`;
}

/** Urgency → the `enquiries.timeline` enum, so the desk's filters see it. */
export function toEnquiryTimeline(
  urgency: LpUrgency | null | undefined,
): (typeof ENQUIRY_TIMELINES)[number] | null {
  switch (urgency) {
    case "this_month":
      return "now";
    case "two_months":
      return "three_months";
    case "flexible":
      return "browsing";
    default:
      return null;
  }
}

/** Intent → the `enquiries.inferred_constraints.intent` vocabulary. */
export function toEnquiryIntent(
  intent: LpIntent,
): (typeof ENQUIRY_INTENTS)[number] {
  return intent === "sell" ? "sell" : "rent";
}
