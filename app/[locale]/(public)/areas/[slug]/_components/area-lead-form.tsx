import type { ResolvedForm } from "@/lib/forms/types";
import { FormRenderer } from "../../../_components/forms/form-renderer";

/**
 * The area guide's consultation form.
 *
 * It used to be its own component because the brief asks for two controls the
 * shared enquiry form didn't carry — property type and budget band. Both are
 * ordinary fields in the Forms Manager now: the type rides in the brief as a
 * labelled line, and the budget band's option value carries its bounds, which
 * populate `budget_min` / `budget_max` for lead scoring. So the component is
 * down to what is genuinely specific to this surface — the community's name,
 * which reaches the copy as the `{area}` token.
 *
 * Editable at /admin/forms → "Request a free consultation".
 */
export function AreaLeadForm({
  form,
  areaName,
  submitLabel,
  className,
}: {
  /** Resolved from /admin/forms by the area page. */
  form: ResolvedForm;
  areaName: string;
  /** The area page's own CTA override, from Pages & blocks. */
  submitLabel?: string | null;
  className?: string;
}) {
  return (
    <FormRenderer
      form={form}
      tokens={{ area: areaName }}
      className={className}
      successStyle="soft"
      allowAnother
      toastErrors
      successToast="Request sent — an advisor will be in touch."
      copyOverride={submitLabel ? { submit_label: submitLabel } : undefined}
    />
  );
}
