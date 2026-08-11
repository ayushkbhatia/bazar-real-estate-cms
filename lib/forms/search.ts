/**
 * Turning a lead form's answers into a search URL.
 *
 * The /rent brief's button says "Find Rentals", so it has to find rentals. The
 * enquiry is filed first and this only decides where the visitor lands next —
 * which is why it is a pure function of answers the browser already holds, and
 * why nothing here is trusted: the filters it produces are re-parsed by
 * `lib/filters/property.ts` on arrival, exactly as a hand-typed URL would be.
 *
 * The bindings live on the form definition rather than in an
 * `if (formKey === "rent_hero_enquiry")` here, so the next form that wants the
 * behaviour declares it instead of editing this file.
 */

import { activeFields } from "./resolve";
import { parseRangeValue } from "./types";
import type { FormOption, ResolvedForm } from "./types";

type Dynamic = Record<string, FormOption[]>;

/**
 * The path and query a submission should send the visitor to, or null when the
 * form doesn't redirect.
 *
 * Answers that say nothing are left out rather than sent as blanks. A slider
 * handle still parked on its end of the scale parses to `null` — the visitor
 * expressed no bound there — and `?price_max=` on the URL would read as a
 * constraint they never chose.
 */
export function buildSearchRedirect(
  form: ResolvedForm,
  values: Record<string, unknown>,
  dynamic: Dynamic = {},
): string | null {
  const redirect = form.def.searchRedirect;
  if (!redirect) return null;

  const params = new URLSearchParams();

  // Only the questions the visitor was actually asked: a commercial tenant's
  // hidden bedroom field must not filter the results they land on.
  for (const field of activeFields(form, values)) {
    const bindings = redirect.bind[field.key];
    if (!bindings) continue;

    const raw = values[field.key];
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") continue;

    for (const binding of bindings) {
      if (field.type === "range") {
        const range = parseRangeValue(text);
        const side = binding.part === "max" ? range.max : range.min;
        if (side != null) params.set(binding.param, String(side));
        continue;
      }

      if (binding.textParam) {
        const match = (dynamic[field.key] ?? field.options ?? []).find(
          (option) =>
            option.label.toLowerCase() === text.toLowerCase() ||
            (option.value || option.label).toLowerCase() === text.toLowerCase(),
        );
        params.set(
          match ? binding.param : binding.textParam,
          match ? match.value || match.label : text,
        );
        continue;
      }

      params.set(binding.param, text);
    }
  }

  const query = params.toString();
  return query ? `${redirect.path}?${query}` : redirect.path;
}
