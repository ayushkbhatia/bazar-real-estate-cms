/**
 * Turning a resolved form into a validator.
 *
 * The rules a visitor is held to are the rules an editor typed, so the schema
 * is built at request time from the same `ResolvedForm` the renderer draws —
 * on the client for instant feedback, and again on the server, where it is the
 * only one that counts. A hand-rolled POST that skips the browser gets the
 * editor's rules applied to it, not a laxer server-side approximation.
 *
 * Messages are written the way the rest of the site writes them ("Tell us a
 * bit more", not "String must contain at least 2 character(s)") because they
 * are read by visitors, not by us.
 */

import { z } from "zod";
import type { FormFieldDef, ResolvedForm } from "./types";
import { visibleFields } from "./resolve";

const MAX_TEXT = 200;
const MAX_LONG_TEXT = 2000;

function labelOf(field: FormFieldDef): string {
  return field.label.trim() || field.key;
}

/** Option values a select / chips / radio field will accept. */
export function allowedValues(
  field: FormFieldDef,
  dynamic: Record<string, { label: string; value: string }[]> = {},
): string[] {
  if (field.optionSource) {
    return (dynamic[field.key] ?? []).map((o) => o.value);
  }
  return (field.options ?? []).map((o) => o.value || o.label);
}

function fieldSchema(
  field: FormFieldDef,
  dynamic: Record<string, { label: string; value: string }[]>,
): z.ZodTypeAny {
  const label = labelOf(field);

  switch (field.type) {
    case "checkbox": {
      const base = z.boolean();
      return field.required
        ? base.refine((v) => v === true, `${label} is required`)
        : base.optional();
    }

    case "number": {
      // Arrives as a string from the input; `normaliseSubmission` has already
      // turned it into a number or null by the time this runs.
      let base = z.number().int();
      if (field.min != null)
        base = base.min(field.min, `${label} looks too small`);
      if (field.max != null)
        base = base.max(field.max, `${label} looks too large`);
      return field.required ? base : base.nullable().optional();
    }

    case "email": {
      const base = z.string().trim().toLowerCase().email("Enter a valid email");
      return field.required
        ? base
        : z.union([base, z.literal("")]).optional();
    }

    case "select":
    case "chips":
    case "radio": {
      const values = allowedValues(field, dynamic);
      // An empty option list means the options come from live records that
      // aren't loaded here (server-side revalidation of a project dropdown,
      // say). Fall back to a bounded string rather than rejecting everything.
      const base =
        values.length > 0
          ? z.string().refine((v) => values.includes(v), `Pick a ${label.toLowerCase()}`)
          : z.string().max(MAX_TEXT);
      return field.required
        ? base
        : z.union([base, z.literal("")]).nullable().optional();
    }

    case "textarea": {
      const base = z
        .string()
        .trim()
        .min(2, "Tell us a bit more")
        .max(MAX_LONG_TEXT, `Trim ${label.toLowerCase()} to under 2000 characters`);
      return field.required ? base : z.union([base, z.literal("")]).optional();
    }

    case "tel":
    case "phone_dial": {
      const base = z
        .string()
        .trim()
        .min(5, "That number looks too short")
        .max(32, "That number looks too long");
      return field.required ? base : z.union([base, z.literal("")]).optional();
    }

    default: {
      const base = z
        .string()
        .trim()
        .min(2, `${label} is too short`)
        .max(MAX_TEXT, `${label} is too long`);
      return field.required ? base : z.union([base, z.literal("")]).optional();
    }
  }
}

/**
 * The whole form. Contact-reachability is enforced across fields rather than
 * per field: an enquiry needs an email *or* a phone, which is the rule
 * `enquirySchema` has always applied and the reason neither box is marked
 * required on its own.
 */
export function buildFormSchema(
  form: ResolvedForm,
  dynamic: Record<string, { label: string; value: string }[]> = {},
): z.ZodType<Record<string, unknown>> {
  const fields = visibleFields(form);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) shape[field.key] = fieldSchema(field, dynamic);

  const base = z.object(shape).passthrough();

  const emailField = fields.find((f) => f.mapping === "email");
  const phoneField = fields.find((f) => f.mapping === "phone");
  const needsEither =
    form.def.handler === "enquiry" &&
    emailField != null &&
    phoneField != null &&
    !emailField.required &&
    !phoneField.required;

  if (!needsEither) return base as z.ZodType<Record<string, unknown>>;

  return base.refine(
    (values) => {
      const email = String(values[emailField.key] ?? "").trim();
      const phone = String(values[phoneField.key] ?? "").trim();
      return email.length > 0 || phone.length > 0;
    },
    {
      message: "We need at least an email or a phone number",
      path: [emailField.key],
    },
  ) as unknown as z.ZodType<Record<string, unknown>>;
}

/**
 * Pre-validation coercion, mirroring `normaliseEnquiryInput`: blanks become
 * blanks (not undefined), numbers parse, text trims, email lowercases. Runs on
 * the server before the schema so the browser's shapes and a raw POST's shapes
 * converge before anything is judged.
 */
export function normaliseSubmission(
  form: ResolvedForm,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of visibleFields(form)) {
    const value = raw[field.key];
    switch (field.type) {
      case "checkbox":
        out[field.key] = value === true || value === "true" || value === "on";
        break;
      case "number": {
        if (value === "" || value == null) {
          out[field.key] = null;
          break;
        }
        const digits = String(value).replace(/[^\d.-]/g, "");
        const n = Number(digits);
        out[field.key] = Number.isFinite(n) ? Math.trunc(n) : null;
        break;
      }
      case "email":
        out[field.key] = String(value ?? "").trim().toLowerCase();
        break;
      default:
        out[field.key] = typeof value === "string" ? value.trim() : (value ?? "");
    }
  }
  return out;
}

/** Zod issues → `{ fieldKey: message }`, first message per field. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
