"use server";

import * as Sentry from "@sentry/nextjs";
import { getForm } from "@/lib/queries/forms";
import {
  buildFormBrief,
  buildSubmissionData,
  extractLead,
  type DynamicOptions,
} from "@/lib/forms/submission";
import { captureFormSubmission } from "@/lib/forms/record";
import {
  buildFormSchema,
  fieldErrorsFrom,
  normaliseSubmission,
} from "@/lib/forms/validate";
import { visibleFields } from "@/lib/forms/resolve";
import type { FormOption, ResolvedForm } from "@/lib/forms/types";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { list, type SectionValues } from "@/lib/master-pages";
import { createEnquiry } from "../_actions";
import { subscribeToNewsletter } from "./newsletter";
import { submitServiceLead } from "../services/_actions";

export type SubmitFormResult =
  | { status: "ok"; enquiryId: string | null; note?: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type FormSubmitContext = {
  /** The project a development-page form is filed against. */
  developmentId?: string | null;
  developmentName?: string | null;
  propertyId?: string | null;
  propertyReference?: string | null;
  /** The page the visitor was on, slug included. */
  path?: string | null;
};

/**
 * The one entry point for every CMS-managed form.
 *
 * It re-resolves the form server-side rather than trusting the payload: the
 * browser has a copy of the field list, but the rules a visitor is held to are
 * the ones stored in the database at the moment they press the button. A stale
 * tab, a hand-rolled POST and a page that never reloaded all get judged
 * against the same current definition.
 *
 * Downstream it does not reinvent intake. Each handler is the action that
 * already owns that lead type — `createEnquiry` for the generic pipeline,
 * `submitServiceLead` for the two service landings, `subscribeToNewsletter`
 * for the double opt-in — so rate limiting, advisor routing, the
 * `on_enquiry_created` trigger and the Resend auto-reply keep working exactly
 * as they did. What this adds is the CMS-shaped front half, and the submission
 * log behind it.
 */
export async function submitForm(
  formKey: string,
  rawValues: Record<string, unknown>,
  context: FormSubmitContext = {},
): Promise<SubmitFormResult> {
  let form: ResolvedForm;
  try {
    form = await getForm(formKey);
  } catch {
    return { status: "error", message: "That form is no longer available." };
  }

  if (!form.enabled) {
    return {
      status: "error",
      message:
        "This form is closed at the moment. Please use the contact page and we'll pick it up from there.",
    };
  }

  const dynamic = await loadDynamicOptions(form);

  const normalised = normaliseSubmission(form, rawValues);
  const parsed = buildFormSchema(form, dynamic).safeParse(normalised);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const values = parsed.data as Record<string, unknown>;
  const lead = extractLead(form, values, dynamic);
  const tokens = {
    project: context.developmentName ?? null,
    reference: context.propertyReference ?? null,
  };

  const sourcePath = context.path ?? form.def.path;
  const data = buildSubmissionData(form, values);

  switch (form.def.handler) {
    case "newsletter": {
      const result = await subscribeToNewsletter({
        email: lead.email,
        source: form.def.newsletterSource ?? "insights_header",
      });
      if (result.status === "error") {
        return { status: "error", message: result.message };
      }
      // No `captureFormSubmission` here: `subscribeToNewsletter` logs its own,
      // so every signup — including the two surfaces that still call it
      // directly — lands in Responses exactly once.
      return {
        status: "ok",
        enquiryId: null,
        // "already confirmed" is a success from the visitor's side, but the
        // wording has to be the newsletter action's, not the form's.
        note: result.status === "already_confirmed" ? result.message : undefined,
      };
    }

    case "service_lead": {
      const kind =
        form.def.enquirySource === "property_management"
          ? "management"
          : "consultation";
      const interest = pickInterest(form, values, dynamic);
      const result = await submitServiceLead({
        kind,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        location: String(values.location ?? ""),
        property_type: String(values.property_type ?? ""),
        interest: interest.label,
        intent: interest.intent,
        message: lead.message,
      });
      if (result.status === "error") {
        return {
          status: "error",
          message: result.message,
          fieldErrors: result.fieldErrors,
        };
      }
      await captureFormSubmission({
        formKey,
        data,
        enquiryId: result.enquiryId ?? null,
        sourcePath,
      });
      return { status: "ok", enquiryId: result.enquiryId ?? null };
    }

    default: {
      const brief = buildFormBrief(form, lead, values, tokens, dynamic);
      const result = await createEnquiry({
        name: leadName(lead.name, lead.email, lead.phone),
        email: lead.email,
        phone: lead.phone,
        message: brief,
        intent: normaliseIntent(lead.intent),
        timeline: lead.timeline,
        budget_min: lead.budgetMin,
        budget_max: lead.budgetMax,
        source: form.def.enquirySource ?? "contact_page",
        property_id: lead.propertyId ?? context.propertyId ?? null,
        development_id: lead.developmentId ?? context.developmentId ?? null,
      });
      if (result.status === "error") {
        return {
          status: "error",
          message: result.message,
          fieldErrors: result.fieldErrors,
        };
      }
      await captureFormSubmission({
        formKey,
        data,
        enquiryId: result.id,
        sourcePath,
      });
      return { status: "ok", enquiryId: result.id };
    }
  }
}

/**
 * A lead with no name is still a lead.
 *
 * The name box is not locked on most forms — an editor may legitimately decide
 * a two-field "email and phone" card converts better — and `enquiries.name` is
 * not nullable. Rather than reject the submission over a field the editor
 * chose to remove, fall back to the part of the address before the @, then to
 * the number. The desk sees where it came from either way.
 */
function leadName(name: string, email: string, phone: string): string {
  if (name.trim().length >= 2) return name.trim();
  const local = email.split("@")[0]?.trim();
  if (local && local.length >= 2) return local;
  if (phone.trim().length >= 5) return phone.trim();
  return "Website enquiry";
}

/** Only the four values `enquirySchema` knows survive; the rest ride in the brief. */
function normaliseIntent(intent: string | null): string | null {
  const known = ["buy", "sell", "rent", "invest", "manage"];
  return intent && known.includes(intent) ? intent : null;
}

function pickInterest(
  form: ResolvedForm,
  values: Record<string, unknown>,
  dynamic: DynamicOptions,
): { label: string; intent: string | null } {
  const field = visibleFields(form).find(
    (f) => f.optionSource === "consultation_interests",
  );
  if (!field) return { label: "", intent: null };
  const value = String(values[field.key] ?? "");
  if (!value) return { label: "", intent: null };
  const match = (dynamic[field.key] ?? []).find(
    (o) => (o.value || o.label) === value,
  );
  return { label: match?.label ?? value, intent: match?.intent ?? null };
}

type RawInterestOption = { enabled?: boolean; label?: string; intent?: string };

/**
 * Options that come from live records, loaded server-side.
 *
 * Only the consultation interests are needed here: they carry the `intent` tag
 * the lead is filed under, and taking that from the browser would let anyone
 * mislabel their own lead. The project dropdown's value is a uuid that
 * `enquirySchema` already validates and the developments table already
 * constrains, so re-fetching every launch on every submit buys nothing.
 */
async function loadDynamicOptions(form: ResolvedForm): Promise<DynamicOptions> {
  const field = visibleFields(form).find(
    (f) => f.optionSource === "consultation_interests",
  );
  if (!field) return {};
  try {
    const content = await getMasterPageContent("consultation");
    const values: SectionValues = content.section("hero_form")?.values ?? {};
    const options: FormOption[] = list<RawInterestOption>(values, "options")
      .filter((o) => o.enabled !== false && (o.label ?? "").trim() !== "")
      .map((o) => ({
        label: o.label!.trim(),
        value: o.label!.trim(),
        intent: (o.intent ?? "").trim().toLowerCase() || null,
      }));
    return { [field.key]: options };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: "forms/dynamic-options" },
    });
    return {};
  }
}
