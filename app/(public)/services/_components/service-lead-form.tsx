import { cn } from "@/lib/utils";
import type { FormOption, ResolvedForm } from "@/lib/forms/types";
import { FormRenderer } from "../../_components/forms/form-renderer";

export type InterestOption = {
  label: string;
  intent: string | null;
};

export type ServiceLeadCopy = {
  title: string | null;
  sub: string | null;
  submitLabel: string | null;
  note: string | null;
  successTitle: string | null;
  successBody: string | null;
  /** Consultation only — the question above the interest buttons. */
  interestLabel?: string | null;
};

type Props = {
  /** Resolved from /admin/forms by the page. */
  form: ResolvedForm;
  copy: ServiceLeadCopy;
  /** Management only — suggestions for the location field. */
  areas?: string[];
  /** Management only — the Property Type options. */
  propertyTypes?: readonly string[];
  /** Consultation only. */
  interestOptions?: InterestOption[];
  className?: string;
};

/**
 * The lead card on /services/manage and /services/consultation.
 *
 * One component for both, as before: the contact block, the submit path and
 * the confirmation are identical, and only the qualification tail differs.
 * What changed is who owns the tail — it is now the field list in
 * /admin/forms rather than a `kind` branch in here, so an editor can add
 * "Which building?" to the management form without this file knowing.
 *
 * The heading, button, small print and confirmation stay in Pages & blocks,
 * where they already were; `copyOverride` is how they reach the renderer. Two
 * writable copies of one string would be worse than the split.
 */
export function ServiceLeadForm({
  form,
  copy,
  areas,
  propertyTypes,
  interestOptions,
  className,
}: Props) {
  // The interest question's label lives on the page, not on the form — see
  // the note above. Everything else about the field is the manager's.
  const effective: ResolvedForm = copy.interestLabel
    ? {
        ...form,
        fields: form.fields.map((field) =>
          field.optionSource === "consultation_interests"
            ? { ...field, label: copy.interestLabel! }
            : field,
        ),
      }
    : form;

  const dynamicOptions: Record<string, FormOption[]> = {};
  for (const field of effective.fields) {
    if (field.optionSource === "areas") {
      dynamicOptions[field.key] = (areas ?? []).map((a) => ({
        label: a,
        value: a,
      }));
    }
    if (field.optionSource === "property_types") {
      dynamicOptions[field.key] = (propertyTypes ?? []).map((t) => ({
        label: t,
        value: t,
      }));
    }
    if (field.optionSource === "consultation_interests") {
      dynamicOptions[field.key] = (interestOptions ?? []).map((o) => ({
        label: o.label,
        value: o.label,
        intent: o.intent,
      }));
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-bz-border bg-bz-surface p-6 md:p-8",
        className,
      )}
    >
      {copy.title ? (
        <h2
          className="serif text-[26px] md:text-[30px] leading-[1.1]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {copy.title}
        </h2>
      ) : null}
      {copy.sub ? (
        <p className="mt-2.5 text-[14px] text-bz-ink-2 leading-relaxed">
          {copy.sub}
        </p>
      ) : null}

      <FormRenderer
        form={effective}
        dynamicOptions={dynamicOptions}
        className="mt-6"
        successStyle="serif"
        allowAnother
        toastErrors
        copyOverride={{
          submit_label: copy.submitLabel ?? undefined,
          consent_note: copy.note ?? undefined,
          success_title: copy.successTitle ?? undefined,
          success_body: copy.successBody ?? undefined,
        }}
      />
    </div>
  );
}
