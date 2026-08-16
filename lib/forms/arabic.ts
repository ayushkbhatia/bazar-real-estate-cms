/**
 * Fill a resolved form's blank Arabic twins from the generated store.
 *
 * The same idea as `fillArabic` for master-page sections, and deliberately the
 * same store: entries are keyed by the English, so "Submit" has one Arabic
 * whether it sits on a form, a section or an area guide.
 *
 * Runs on the RESOLVED form — after `mergeCopy` and `mergeFields` — so it sees
 * exactly the English the visitor will read, whether that came from the
 * registry or from the CMS. Filling the registry defaults instead would serve
 * the default's Arabic under an editor's replacement text, which is the bug
 * measured at 303 slots on the master pages.
 *
 * Never overwrites. A twin with a value was written by an editor or declared in
 * the registry, and both outrank a generated one.
 */
import { arabicFor, type ArabicStore } from "@/lib/i18n/arabic-store";
import { FORM_COPY_KEYS, copyArKey } from "./copy-keys";
import type { FormCopy, FormFieldDef, ResolvedForm } from "./types";

function blank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && !v.trim());
}

export function fillFormCopy(copy: FormCopy, from?: ArabicStore): FormCopy {
  const out: Record<string, unknown> = { ...copy };
  for (const { key } of FORM_COPY_KEYS) {
    const ar = copyArKey(key);
    if (!blank(out[ar])) continue;
    const found = arabicFor(out[key] as string | null, from);
    if (found) out[ar] = found;
  }
  return out as FormCopy;
}

/** The four text keys on a field that carry prose, and their twins. */
const FIELD_TWINS = [
  ["label", "label_ar"],
  ["placeholder", "placeholder_ar"],
  ["help", "help_ar"],
  ["unit", "unit_ar"],
] as const;

export function fillFormField(
  field: FormFieldDef,
  from?: ArabicStore,
): FormFieldDef {
  const out: Record<string, unknown> = { ...field };

  for (const [en, ar] of FIELD_TWINS) {
    if (!blank(out[ar])) continue;
    const found = arabicFor(out[en] as string | null, from);
    if (found) out[ar] = found;
  }

  if (Array.isArray(out.options) && out.options.length) {
    out.options = (out.options as { label: string; label_ar?: string | null }[]).map(
      (opt) => {
        if (!blank(opt.label_ar)) return opt;
        const found = arabicFor(opt.label, from);
        return found ? { ...opt, label_ar: found } : opt;
      },
    );
  }

  return out as FormFieldDef;
}

export function fillFormArabic(form: ResolvedForm, from?: ArabicStore): ResolvedForm {
  return {
    ...form,
    copy: fillFormCopy(form.copy, from),
    fields: form.fields.map((f) => fillFormField(f, from)),
  };
}
