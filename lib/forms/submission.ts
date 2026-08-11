/**
 * Turning a validated submission into a lead.
 *
 * Pure functions, no I/O — the server action does the writing, this decides
 * what to write. Kept separate because the mapping is where the interesting
 * mistakes live: a field an editor moved must still land in the same column,
 * and an answer to a question nobody anticipated must still reach the advisor
 * rather than being dropped for having nowhere to go.
 */

import type { FormFieldDef, FormOption, ResolvedForm } from "./types";
import { renderFormCopy, visibleFields } from "./resolve";

export type DynamicOptions = Record<string, FormOption[]>;

/** Every option a field offers right now, typed or live. */
export function optionsFor(
  field: FormFieldDef,
  dynamic: DynamicOptions = {},
): FormOption[] {
  if (field.optionSource) return dynamic[field.key] ?? [];
  return field.options ?? [];
}

/** The human label behind a stored value — what the advisor should read. */
export function optionLabel(
  field: FormFieldDef,
  value: string,
  dynamic: DynamicOptions = {},
): string {
  if (!value) return "";
  const match = optionsFor(field, dynamic).find(
    (o) => (o.value || o.label) === value,
  );
  return match?.label ?? value;
}

/** The `intent` an option tags the lead with, when it declares one. */
function optionIntent(
  field: FormFieldDef,
  value: string,
  dynamic: DynamicOptions,
): string | null {
  const match = optionsFor(field, dynamic).find(
    (o) => (o.value || o.label) === value,
  );
  return match?.intent ?? null;
}

export type ExtractedLead = {
  name: string;
  email: string;
  phone: string;
  message: string;
  intent: string | null;
  timeline: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  developmentId: string | null;
  propertyId: string | null;
  consented: boolean;
  /** Answers with no column, in the order the form asks them. */
  extras: { key: string; label: string; display: string }[];
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

/**
 * Reads a submission through the form's mappings.
 *
 * Name is assembled from whichever of the three name mappings the form uses:
 * three live forms split first and last, the rest ask once. Doing it here
 * rather than in each caller is the point of the mapping vocabulary.
 */
export function extractLead(
  form: ResolvedForm,
  values: Record<string, unknown>,
  dynamic: DynamicOptions = {},
): ExtractedLead {
  const fields = visibleFields(form);
  const lead: ExtractedLead = {
    name: "",
    email: "",
    phone: "",
    message: "",
    intent: null,
    timeline: null,
    budgetMin: null,
    budgetMax: null,
    developmentId: null,
    propertyId: null,
    consented: false,
    extras: [],
  };

  let first = "";
  let last = "";

  for (const field of fields) {
    const raw = values[field.key];
    const value = str(raw);

    switch (field.mapping) {
      case "name":
        lead.name = value;
        break;
      case "first_name":
        first = value;
        break;
      case "last_name":
        last = value;
        break;
      case "email":
        lead.email = value.toLowerCase();
        break;
      case "phone":
        lead.phone = value;
        break;
      case "message":
        lead.message = value;
        break;
      case "intent":
        lead.intent = optionIntent(field, value, dynamic) ?? (value || null);
        break;
      case "timeline":
        lead.timeline = value || null;
        break;
      case "budget_min":
        lead.budgetMin = typeof raw === "number" ? raw : null;
        break;
      case "budget_max":
        lead.budgetMax = typeof raw === "number" ? raw : null;
        break;
      case "development_id":
        lead.developmentId = value || null;
        break;
      case "property_id":
        lead.propertyId = value || null;
        break;
      case "consent":
        lead.consented = raw === true;
        break;
      default: {
        // Everything else is a question the schema knows nothing about. Skip
        // the blanks — an unanswered optional question is not information, and
        // padding the brief with "Bedrooms: —" lines makes it harder to read.
        const display =
          field.type === "checkbox"
            ? raw === true
              ? "Yes"
              : ""
            : optionLabel(field, value, dynamic) || value;
        if (display) {
          lead.extras.push({ key: field.key, label: field.label, display });
        }
      }
    }
  }

  if (!lead.name) lead.name = [first, last].filter(Boolean).join(" ").trim();
  return lead;
}

/**
 * The brief the desk reads.
 *
 * `briefPrefix` frames a form that has no message box at all ("List my
 * property — Sell Your Property."), and prefixes the visitor's own words when
 * it does have one, which is what the off-plan form has always done. Extra
 * answers follow as labelled lines, so a question added in the CMS this
 * morning is legible in the inbox this afternoon without anything downstream
 * knowing it exists.
 */
export function buildFormBrief(
  form: ResolvedForm,
  lead: ExtractedLead,
  rawValues: Record<string, unknown>,
  tokens: Record<string, string | null | undefined> = {},
  dynamic: DynamicOptions = {},
): string {
  // Any field may be referenced by key from a brief prefix — `{purpose}` on
  // the owner card, `{project}` on the off-plan one — and always by the label
  // a visitor saw, never by the value we happen to store it under.
  const fieldTokens: Record<string, string> = {};
  for (const field of visibleFields(form)) {
    const value = str(rawValues[field.key]);
    if (!value) continue;
    fieldTokens[field.key] = optionLabel(field, value, dynamic) || value;
  }

  const prefix = renderFormCopy(form.def.briefPrefix ?? null, {
    ...fieldTokens,
    ...tokens,
  });

  const head = [prefix, lead.message].filter(Boolean).join(" ").trim();
  const lines = lead.extras.map((e) => `${e.label}: ${e.display}`);

  return [head || form.def.name, ...(lines.length ? ["", ...lines] : [])]
    .join("\n")
    .trim();
}

/**
 * What gets written to `form_submissions.data` — every answer, plus the labels
 * as they read at the time. See the migration for why the labels are frozen.
 */
export function buildSubmissionData(
  form: ResolvedForm,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const labels: Record<string, string> = {};
  const data: Record<string, unknown> = {};
  for (const field of visibleFields(form)) {
    labels[field.key] = field.label;
    data[field.key] = values[field.key] ?? null;
  }
  return { ...data, _labels: labels };
}
