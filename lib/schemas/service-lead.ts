import { z } from "zod";
import { LP_TYPES } from "./list-property";
import { CONSULTATION_INTENTS } from "@/lib/master-pages/sections/property-consultation";

/**
 * The lead forms on the two service landings — /services/manage and
 * /services/consultation.
 *
 * One schema for both because they are the same lead with two different
 * qualification tails: the management form asks where the property is and what
 * it is, the consultation form asks what the person is trying to do. Two
 * schemas would have duplicated the contact block, the normalisation and the
 * phone handling.
 *
 * Deliberately *not* folded into `enquirySchema`: that one models the generic
 * intake and has no room for a property type, a location or an interest, all
 * of which the desk works these leads by.
 *
 * No `.transform()` here, for the same reason `enquirySchema` has none — INPUT
 * and OUTPUT stay the same shape so `useForm<ServiceLeadInput>` type-checks
 * against the resolver. Coercion lives in `normaliseServiceLead`.
 */
export const SERVICE_LEAD_KINDS = ["management", "consultation"] as const;
export type ServiceLeadKind = (typeof SERVICE_LEAD_KINDS)[number];

/** The management form's Property Type select, flattened from the owner form. */
export const SERVICE_PROPERTY_TYPES: readonly string[] = [
  ...LP_TYPES.residential,
  ...LP_TYPES.commercial.filter((t) => !LP_TYPES.residential.includes(t)),
];

const optionalText = (max: number) => z.string().max(max).optional();

export const serviceLeadSchema = z
  .object({
    kind: z.enum(SERVICE_LEAD_KINDS),
    name: z
      .string()
      .min(2, "Enter your full name")
      .max(120, "That name is too long"),
    phone: z
      .string()
      .min(5, "Enter a phone number we can reach you on")
      .max(32, "That number is too long"),
    email: z.string().email("Enter a valid email"),
    /** Management only — free text, matched against the area index for routing. */
    location: optionalText(160),
    /** Management only. */
    property_type: optionalText(60),
    /** Consultation only — the label of the option that was picked. */
    interest: optionalText(40),
    /**
     * Consultation only — the intent that option is tagged with. Editors type
     * it into the CMS, so an unrecognised value is dropped before it gets here
     * rather than trusted.
     */
    intent: z.enum(CONSULTATION_INTENTS).nullable().optional(),
    message: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "management") {
      if (!v.location?.trim())
        ctx.addIssue({
          code: "custom",
          path: ["location"],
          message: "Tell us where the property is",
        });
      if (!v.property_type?.trim())
        ctx.addIssue({
          code: "custom",
          path: ["property_type"],
          message: "Pick a property type",
        });
    }
    if (v.kind === "consultation" && !v.interest?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["interest"],
        message: "Tell us what you're interested in",
      });
    }
  });

export type ServiceLeadInput = z.infer<typeof serviceLeadSchema>;

/** Blank strings → undefined, everything trimmed, email lowercased. */
export function normaliseServiceLead(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const key of [
    "name",
    "phone",
    "email",
    "location",
    "property_type",
    "interest",
    "message",
  ] as const) {
    const value = out[key];
    if (typeof value !== "string") continue;
    const text = key === "email" ? value.trim().toLowerCase() : value.trim();
    out[key] = text === "" ? undefined : text;
  }
  if (out.intent === "" || out.intent === undefined) out.intent = null;
  return out;
}

/**
 * The brief the desk reads in the enquiry thread. The `on_enquiry_created`
 * trigger copies `brief_raw` into the first message, so everything the advisor
 * needs to make the call has to be in this string — the jsonb payload beside it
 * is for filtering, not for reading.
 */
export function buildServiceBrief(v: ServiceLeadInput): string {
  const lines: string[] = [
    v.kind === "management"
      ? "Property management enquiry"
      : "Property consultation enquiry",
  ];
  if (v.location) lines.push(`Location: ${v.location}`);
  if (v.property_type) lines.push(`Property type: ${v.property_type}`);
  if (v.interest) lines.push(`Interested in: ${v.interest}`);
  if (v.message) lines.push("", v.message);
  return lines.join("\n");
}
