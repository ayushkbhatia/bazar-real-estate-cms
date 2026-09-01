/**
 * What an editor actually changed — for the forms a bespoke component draws.
 *
 * `control: "full"` forms need nothing here: `FormRenderer` reads the resolved
 * field list and that is the whole story. A `control: "labels"` form is drawn
 * by its own component, which already has wording — translated wording, in
 * `messages/{en,ar}/forms.json`, hand-written and reviewed. Handing it the
 * resolved labels wholesale would throw that away: an untouched form would
 * start rendering registry English on `/ar`, which is a regression dressed as a
 * feature.
 *
 * So the component keeps its catalogue as the default and takes the CMS only
 * where the CMS has something to say. This module works out where that is, by
 * diffing the resolved form against the registry defaults **for the same
 * locale**:
 *
 *   resolved.label ≠ default.label  ⇒  an editor typed this. Use it.
 *   resolved.label = default.label  ⇒  nobody has touched it. Use the catalogue.
 *
 * Comparing per-locale is what makes that sound. `getForm` folds `label_ar`
 * into `label` on `/ar`, so on that page the resolved label is Arabic and the
 * bare registry label is English — diffing against the unfolded registry would
 * mark every field overridden and swap the whole page onto the generated
 * Arabic. Folding both sides first means the comparison is like for like: the
 * registry's own Arabic against the row's.
 *
 * The result is the Forms Manager contract, held one level deeper than usual:
 * nothing changes visually until someone edits a field, and the thing that
 * changes is exactly the thing they edited.
 */

import type { FormSaveInput } from "@/lib/schemas/form";
import type { FormFieldDef, ResolvedForm } from "./types";

/** Blank-as-absent, matching the save action's own rule. */
function orNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** The wording an editor supplied for one field, where it differs from the default. */
export type FieldOverride = {
  label?: string;
  placeholder?: string;
  help?: string;
  /** The suffix inside a number input — "ft²". */
  unit?: string;
  /** Option value → the editor's label for it. Only the changed ones. */
  options?: Record<string, string>;
};

/** Field key → what the editor changed about it. Absent key means "nothing". */
export type FormOverrides = Record<string, FieldOverride>;

/** The four strings on a field that a bespoke component can be handed. */
const TEXT_KEYS = ["label", "placeholder", "help", "unit"] as const;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function fieldOverride(
  live: FormFieldDef,
  base: FormFieldDef,
): FieldOverride | null {
  const out: FieldOverride = {};

  for (const key of TEXT_KEYS) {
    const now = text(live[key]);
    // A cleared string is not an override: the component's own default is a
    // real string, and "the editor emptied the box" cannot mean "render
    // nothing" for a label the form is unusable without.
    if (!now || now === text(base[key])) continue;
    out[key] = now;
  }

  const baseOptions = new Map(
    (base.options ?? []).map((o) => [o.value, o.label]),
  );
  const options: Record<string, string> = {};
  for (const option of live.options ?? []) {
    const label = text(option.label);
    if (!label || label === baseOptions.get(option.value)) continue;
    // An option the registry doesn't declare has no slot in the component:
    // the values are what the server validates against, and inventing one
    // would render a pill nobody can submit.
    if (!baseOptions.has(option.value)) continue;
    options[option.value] = label;
  }
  if (Object.keys(options).length > 0) out.options = options;

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Diff a resolved form against the registry defaults, both already folded to
 * the same locale.
 *
 * Fields are matched by key. One the registry doesn't declare is skipped — a
 * bespoke component has no slot to draw it in, and a `labels` save is pinned
 * to the registry's shape anyway, so it can only arrive from a stale row
 * written before a field was retired.
 */
export function formOverrides(
  resolved: ResolvedForm,
  base: ResolvedForm,
): FormOverrides {
  const byKey = new Map(base.fields.map((f) => [f.key, f]));
  const out: FormOverrides = {};
  for (const live of resolved.fields) {
    const against = byKey.get(live.key);
    if (!against) continue;
    const diff = fieldOverride(live, against);
    if (diff) out[live.key] = diff;
  }
  return out;
}

/**
 * A `control: "labels"` save, reduced to the half of it that is real.
 *
 * The wizard on /services/sell asks fourteen questions in a fixed order, of
 * fixed types, validated server-side against fixed values. What an editor owns
 * there is the wording. So rather than trusting the payload's field list, this
 * walks the REGISTRY's list and takes only the strings off whatever the editor
 * sent for the same key: label, placeholder, helper, unit, option labels, and
 * each one's Arabic twin.
 *
 * Everything else — which fields, their order, their types, their mappings,
 * their option *values*, their conditions — comes from the registry, so a
 * stale tab or a hand-rolled POST cannot restructure a form whose component
 * would ignore the change and whose server would reject the answers.
 *
 * A field the payload doesn't mention keeps its registry wording rather than
 * being dropped: the editor's screen has no control that removes it, so its
 * absence is a bug in the request, not a decision.
 */
export function pinToRegistry(
  def: { fields: FormFieldDef[] },
  sent: FormSaveInput["fields"],
): FormSaveInput["fields"] {
  const byKey = new Map(sent.map((f) => [f.key, f]));
  return def.fields.map((base) => {
    const edit = byKey.get(base.key);
    // A field whose wording lives in Pages & blocks keeps the registry's copy
    // of it, whatever arrived. Two writable copies of one string is the bug
    // `copyFromPage` exists to prevent.
    const words = edit && !base.copyFromPage ? edit : null;
    const baseOptions = base.options ?? [];
    const editOptions = new Map(
      (words?.options ?? []).map((o) => [o.value, o]),
    );
    return {
      key: base.key,
      label: words?.label?.trim() || base.label,
      label_ar: words?.label_ar ?? base.label_ar ?? null,
      type: base.type,
      mapping: base.mapping,
      placeholder: orNull(words?.placeholder) ?? base.placeholder ?? null,
      placeholder_ar: words?.placeholder_ar ?? base.placeholder_ar ?? null,
      help: orNull(words?.help) ?? base.help ?? null,
      help_ar: words?.help_ar ?? base.help_ar ?? null,
      note: base.note ?? null,
      required: base.required,
      enabled: base.enabled,
      width: base.width,
      options: baseOptions.map((option) => {
        const edited = editOptions.get(option.value);
        return {
          // The value is what the browser submits and the server validates —
          // only the label moves.
          value: option.value,
          label: edited?.label?.trim() || option.label,
          label_ar: edited?.label_ar ?? option.label_ar ?? null,
          intent: option.intent ?? null,
        };
      }),
      optionSource: base.optionSource ?? null,
      rows: base.rows ?? null,
      min: base.min ?? null,
      max: base.max ?? null,
      step: base.step ?? null,
      unit: orNull(words?.unit) ?? base.unit ?? null,
      unit_ar: words?.unit_ar ?? base.unit_ar ?? null,
      showWhen: base.showWhen ?? null,
      locked: base.locked ?? false,
      copyFromPage: base.copyFromPage ?? false,
    };
  });
}
