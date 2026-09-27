/**
 * The lead at a glance — the same five facts whichever of the twenty-two forms
 * it came through.
 *
 * Each form asks in its own words: the Buy hero has a budget slider, the area
 * guide has budget pills, the owner wizard asks "How soon do you want to
 * sell?", the contact page asks none of it. The answers already land in the
 * same columns (`budget_min`/`budget_max`, `timeline`,
 * `inferred_constraints.intent`), so the desk can read one strip instead of
 * learning twenty-two forms. The full answers sit underneath for anything the
 * strip leaves out.
 *
 * Pure: reads only what the enquiry row carries.
 */

import type { FormDef } from "@/lib/forms/types";
import type { ENQUIRY_TIMELINES } from "@/lib/schemas/enquiry";

type Timeline = (typeof ENQUIRY_TIMELINES)[number];

export type LeadFact = { label: string; value: string };

const TIMELINE_LABELS: Record<Timeline, string> = {
  now: "Ready now",
  three_months: "Next 3 months",
  six_months: "Next 6 months",
  twelve_months: "Next 12 months",
  browsing: "Just exploring",
};

/**
 * Forms whose sender owns the property rather than wants one.
 *
 * Needed for one word: `intent: "rent"` from the home page's owner card means
 * "let my flat", and from the Rent hero it means "find me one". The column
 * cannot tell them apart; the form can. `profile.test.ts` holds every key here
 * to the registry, so a renamed form fails a test instead of relabelling
 * landlords as tenants.
 */
export const OWNER_FORM_KEYS: ReadonlySet<string> = new Set([
  "home_list_property",
  "areas_list_property",
  "services_sell_list_property",
  "services_manage_lead",
]);

/** The same fact for leads that carry no form key — rows older than 0128. */
const OWNER_SOURCES = new Set(["list_property", "property_management"]);
const OWNER_LEAD_KINDS = new Set(["owner_listing", "service_management"]);

export type LeadFactsInput = {
  source: string;
  formKey: string | null;
  def: FormDef | null;
  inferred: Record<string, unknown> | null;
  budgetMin: number | null;
  budgetMax: number | null;
  timeline: string | null;
  preApproved: boolean;
  locale: string;
  /** `properties.mode` when the lead is about one listing. */
  propertyMode: string | null;
};

export function leadFacts(input: LeadFactsInput): LeadFact[] {
  const facts: LeadFact[] = [];

  const intent = intentLabel(input);
  if (intent) facts.push({ label: "Intent", value: intent });

  const budget = budgetLabel(input.budgetMin, input.budgetMax);
  if (budget) facts.push({ label: "Budget", value: budget });

  const timeline = input.timeline
    ? (TIMELINE_LABELS[input.timeline as Timeline] ?? null)
    : null;
  if (timeline) facts.push({ label: "Timeline", value: timeline });

  if (input.preApproved) facts.push({ label: "Mortgage", value: "Pre-approved" });

  if (input.locale === "ar") facts.push({ label: "Language", value: "Arabic" });

  return facts;
}

/** Whether the person on the other end owns the property in question. */
export function isOwnerLead(
  input: Pick<LeadFactsInput, "formKey" | "source" | "inferred">,
): boolean {
  if (input.formKey && OWNER_FORM_KEYS.has(input.formKey)) return true;
  if (OWNER_SOURCES.has(input.source)) return true;
  const kind = input.inferred?.lead_kind;
  return typeof kind === "string" && OWNER_LEAD_KINDS.has(kind);
}

function intentLabel(input: LeadFactsInput): string | null {
  const stored = input.inferred?.intent;
  const intent =
    (typeof stored === "string" && stored ? stored : null) ??
    input.def?.defaultIntent ??
    intentFromSource(input.source, input.propertyMode);
  if (!intent) return null;

  const owner = isOwnerLead(input);
  switch (intent) {
    case "buy":
      return "Buying";
    case "sell":
      return "Selling";
    case "rent":
      return owner ? "Letting out" : "Renting";
    case "invest":
      return "Investing";
    case "manage":
      return "Management";
    default:
      return null;
  }
}

/**
 * What a lead that names no intent is still plainly after. A question about a
 * rental listing is a renting lead whether or not anyone asked.
 */
function intentFromSource(
  source: string,
  propertyMode: string | null,
): string | null {
  switch (source) {
    case "list_property":
      return "sell";
    case "property_management":
      return "manage";
    case "development_interest":
    case "brochure":
    case "mortgage":
      return "buy";
    case "property_page":
      if (propertyMode === "rent") return "rent";
      if (propertyMode === "buy" || propertyMode === "off_plan") return "buy";
      return null;
    default:
      return null;
  }
}

/** "AED 2M – 4M", "AED 15M+", "Up to AED 1M". Null when neither end is set. */
export function budgetLabel(
  min: number | null,
  max: number | null,
): string | null {
  const lo = min && min > 0 ? min : null;
  const hi = max && max > 0 ? max : null;
  if (lo && hi) return `AED ${compactAed(lo)} – ${compactAed(hi)}`;
  if (lo) return `AED ${compactAed(lo)}+`;
  if (hi) return `Up to AED ${compactAed(hi)}`;
  return null;
}

/** 2500000 → "2.5M", 1250000 → "1.25M", 85000 → "85K". */
export function compactAed(n: number): string {
  const trim = (value: number) => String(Number(value.toFixed(2)));
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 1_000) {
    const k = Number((n / 1_000).toFixed(2));
    // 999,999 rounds to 1000K; say 1M.
    return k >= 1_000 ? `${trim(n / 1_000_000)}M` : `${trim(k)}K`;
  }
  return n.toLocaleString("en-US");
}
