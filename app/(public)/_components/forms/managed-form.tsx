import { getForm } from "@/lib/queries/forms";
import { FormRenderer, type FormRendererProps } from "./form-renderer";

type Props = Omit<FormRendererProps, "form"> & {
  formKey: string;
  /** Rendered instead of the form when an editor has switched it off. */
  fallback?: React.ReactNode;
};

/**
 * Server-side wrapper: resolve the form, then hand it to the renderer.
 *
 * Call sites that are already server components use this. The dialogs can't —
 * they hold open/closed state — so their page resolves the form and passes it
 * down as a prop instead; a `ResolvedForm` is plain JSON and crosses the
 * boundary intact.
 *
 * A switched-off form renders `fallback` (usually nothing). Where the form is
 * the only content of a card, the page checks `enabled` itself and drops the
 * whole card, rather than leaving a heading over an empty box.
 */
export async function ManagedForm({ formKey, fallback = null, ...rest }: Props) {
  const form = await getForm(formKey);
  if (!form.enabled) return <>{fallback}</>;
  return <FormRenderer form={form} {...rest} />;
}
