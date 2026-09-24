/**
 * What the page builder shows of a form before an editor places it.
 *
 * The form picker on a lead-form band used to offer a name and nothing else —
 * "Contact enquiry · Contact page" — and 22 forms is too many to choose between
 * on names. So the editor gets a sketch of the form as it will actually render:
 * which questions, in what order, of what kind, which are required, and what
 * the button says.
 *
 * Built on the server from the same `ResolvedForm` the landing page renders
 * from (`listFormsForAdmin` merges the Forms Manager's edits over the
 * registry), so the sketch shows the form as edited, not as shipped. It is
 * flattened to plain data here rather than handing the client the whole
 * resolved form: the editor needs twenty-odd of these, and none of it needs
 * the handler config, the search redirect or the notify list.
 */

import { visibleFields } from "@/lib/forms/resolve";
import {
  FORM_FIELD_TYPE_LABELS,
  FORM_OPTION_SOURCE_LABELS,
  type FormFieldType,
  type FormFieldWidth,
  type FormHandler,
  type ResolvedForm,
} from "@/lib/forms/types";

/** Options beyond this are summarised as "+ N more" — it is a sketch. */
export const PREVIEW_OPTION_LIMIT = 6;

export type FormPreviewField = {
  key: string;
  label: string;
  type: FormFieldType;
  /** "Dropdown", "Pill buttons" — the Forms Manager's own words. */
  typeLabel: string;
  required: boolean;
  width: FormFieldWidth;
  placeholder: string | null;
  /** The first few option labels, in order. */
  options: string[];
  /** Options past `PREVIEW_OPTION_LIMIT`. */
  moreOptions: number;
  /** Set when the options come from live records rather than a typed list. */
  optionSource: string | null;
  /** "Shown when Property Purpose is Commercial". Null ⇒ always asked. */
  condition: string | null;
  /** number and range — the scale. */
  min: number | null;
  max: number | null;
  unit: string | null;
};

export type FormPreview = {
  key: string;
  name: string;
  surface: string;
  description: string;
  /**
   * Switched off in the Forms Manager. The band renders no form at all and the
   * publish gate refuses the page, so the preview says so before either.
   */
  enabled: boolean;
  /** What a submission becomes — shown so "newsletter" isn't picked for a lead band. */
  handlerLabel: string;
  title: string | null;
  subtitle: string | null;
  submitLabel: string;
  consentNote: string | null;
  fields: FormPreviewField[];
  /** Fields switched off in the manager — counted, not drawn. */
  hiddenFields: number;
  /** Where the editor goes to change any of it. */
  editHref: string;
};

const HANDLER_LABELS: Record<FormHandler, string> = {
  enquiry: "Files an enquiry for the advisory desk",
  newsletter: "Subscribes to the newsletter — not a lead",
  service_lead: "Files a service lead",
  list_property: "Files a listing request",
  valuation: "Files a valuation request",
};

function optionLabel(o: { label: string; value: string }): string {
  return o.label || o.value;
}

export function buildFormPreview(form: ResolvedForm): FormPreview {
  const visible = visibleFields(form);
  const labelOf = new Map(visible.map((f) => [f.key, f.label]));

  const fields: FormPreviewField[] = visible.map((f) => {
    const all = (f.options ?? []).map(optionLabel);
    let condition: string | null = null;
    if (f.showWhen) {
      // Condition values are stored option values; show the controlling
      // field's labels for them where they match, the raw value otherwise.
      const controller = visible.find((c) => c.key === f.showWhen!.field);
      const answers = f.showWhen.values.map((v) => {
        const hit = controller?.options?.find((o) => (o.value || o.label) === v);
        return hit ? optionLabel(hit) : v;
      });
      condition = `Shown when ${labelOf.get(f.showWhen.field) ?? f.showWhen.field} is ${answers.join(" or ")}`;
    }
    return {
      key: f.key,
      label: f.label,
      type: f.type,
      typeLabel: FORM_FIELD_TYPE_LABELS[f.type] ?? f.type,
      required: f.required,
      width: f.width,
      placeholder: f.placeholder ?? null,
      options: all.slice(0, PREVIEW_OPTION_LIMIT),
      moreOptions: Math.max(0, all.length - PREVIEW_OPTION_LIMIT),
      optionSource: f.optionSource
        ? (FORM_OPTION_SOURCE_LABELS[f.optionSource] ?? f.optionSource)
        : null,
      condition,
      min: f.min ?? null,
      max: f.max ?? null,
      unit: f.unit ?? null,
    };
  });

  return {
    key: form.key,
    name: form.def.name,
    surface: form.def.surface,
    description: form.def.description,
    enabled: form.enabled,
    handlerLabel: HANDLER_LABELS[form.def.handler] ?? form.def.handler,
    title: form.copy.title,
    subtitle: form.copy.subtitle,
    submitLabel: form.copy.submit_label,
    consentNote: form.copy.consent_note,
    fields,
    hiddenFields: form.fields.length - visible.length,
    editHref: `/admin/forms/${form.key}`,
  };
}

/** Keyed by form key, the value a `form_key` select stores. */
export function buildFormPreviews(
  forms: ResolvedForm[],
): Record<string, FormPreview> {
  return Object.fromEntries(forms.map((f) => [f.key, buildFormPreview(f)]));
}
