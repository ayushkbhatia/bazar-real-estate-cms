/**
 * Merging what's stored with what the code declares.
 *
 * Same contract as `lib/master-pages`, with one difference that matters: a
 * master page's sections are a fixed set an editor may reorder, while a form's
 * fields are a set an editor may *add to and delete from*. So the rule is:
 *
 *   - no stored rows at all  ⇒ the registry's fields, verbatim. A form nobody
 *     has opened renders exactly as it always has.
 *   - stored rows exist      ⇒ storage wins. A registry field the editor
 *     deleted stays deleted, a field they invented is kept, and the order is
 *     theirs.
 *   - a `locked` registry field is re-attached either way, because the handler
 *     cannot submit without it — a newsletter with no email box is not a
 *     smaller newsletter, it's a broken one.
 *
 * That last rule is why the editor refuses to delete a locked field rather
 * than silently restoring it: a save that quietly grows a field back is worse
 * than one that explains why it won't.
 */

import { getFormDef } from "./registry";
import { FORM_COPY_KEYS, copyArKey } from "./copy-keys";
import type {
  FormCopy,
  FormDef,
  FormFieldDef,
  ResolvedForm,
  StoredForm,
} from "./types";

/** A field row as stored. Shape-compatible with `FormFieldDef` plus ordering. */
export type StoredField = FormFieldDef & { position: number };

function mergeCopy(def: FormDef, stored: Partial<FormCopy> | null): FormCopy {
  if (!stored) return { ...def.copy };
  const out: Record<string, unknown> = { ...def.copy };
  /*
   * Iterates FORM_COPY_KEYS rather than the registry defaults.
   *
   * The old loop was over `Object.keys(out)` — the seven English keys the
   * registry literal happens to carry — so a stored `title_ar` was silently
   * discarded on every read. The Arabic had storage and an editor and no way
   * to reach a renderer.
   */
  for (const { key } of FORM_COPY_KEYS) {
    for (const k of [key, copyArKey(key)] as const) {
      const value = (stored as Record<string, unknown>)[k];
      // `undefined` means "never saved" and falls back; an explicit null means
      // the editor cleared an optional string, and must survive the merge.
      if (value !== undefined) out[k] = value;
    }
  }
  return out as FormCopy;
}

function mergeFields(
  def: FormDef,
  stored: StoredField[] | null,
): FormFieldDef[] {
  if (!stored || stored.length === 0) return def.fields.map((f) => ({ ...f }));

  // `note` is editor-facing guidance written in code, not content an editor
  // owns, so it is always taken from the registry rather than from storage —
  // otherwise the first save would silently drop it.
  const notes = new Map(def.fields.map((f) => [f.key, f.note ?? null]));

  const ordered = [...stored]
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...field }) => ({
      ...field,
      note: notes.get(field.key) ?? null,
    }));

  const byKey = new Map(ordered.map((f) => [f.key, f]));
  const missingLocked = def.fields.filter(
    (f) => f.locked && !byKey.has(f.key),
  );

  // Locked fields land back at their registry position where that position
  // still exists in the stored list, and at the end otherwise. Appending
  // blindly would drop a re-attached email box below the message box.
  if (missingLocked.length === 0) return ordered;

  const out: FormFieldDef[] = [...ordered];
  for (const field of missingLocked) {
    const registryIndex = def.fields.findIndex((f) => f.key === field.key);
    const before = def.fields
      .slice(0, registryIndex)
      .map((f) => f.key)
      .reverse()
      .find((key) => byKey.has(key));
    const at = before ? out.findIndex((f) => f.key === before) + 1 : 0;
    out.splice(at, 0, { ...field });
  }
  return out;
}

/**
 * The effective form. Never throws: an unknown key is a caller bug and returns
 * null, but a partial or stale stored document always resolves to something
 * renderable.
 */
export function resolveForm(
  key: string,
  stored: StoredForm | null,
  storedFields: StoredField[] | null,
): ResolvedForm | null {
  const def = getFormDef(key);
  if (!def) return null;
  return {
    key,
    def,
    enabled: def.alwaysOn ? true : (stored?.enabled ?? true),
    copy: mergeCopy(def, stored?.copy ?? null),
    fields: mergeFields(def, storedFields),
    notifyEmails: stored?.notify_emails ?? [],
    usingDefaults: stored === null && (storedFields?.length ?? 0) === 0,
  };
}

/** The registry defaults for a form, with nothing stored. */
export function defaultForm(key: string): ResolvedForm | null {
  return resolveForm(key, null, null);
}

/** Fields the editor has switched on, in order. Conditions are not applied. */
export function visibleFields(form: ResolvedForm): FormFieldDef[] {
  return form.fields.filter((f) => f.enabled);
}

/**
 * Fields the form is actually asking, given the answers so far.
 *
 * `visibleFields` minus every conditional whose controlling answer doesn't
 * reveal it. This is the list the renderer draws, the list the schema
 * validates, and the list a submission is read through — all three have to
 * agree, or a visitor gets held to a question they were never shown.
 *
 * Conditions are resolved in order and a field can only depend on one before
 * it, so a chain collapses correctly in a single pass: hide the purpose
 * selector and everything hanging off it goes with it, rather than becoming
 * required-but-invisible.
 */
export function activeFields(
  form: ResolvedForm,
  values: Record<string, unknown>,
): FormFieldDef[] {
  const out: FormFieldDef[] = [];
  const shown = new Set<string>();
  for (const field of visibleFields(form)) {
    if (!conditionMet(field.showWhen ?? null, values, shown)) continue;
    shown.add(field.key);
    out.push(field);
  }
  return out;
}

/**
 * Whether a condition's controlling answer reveals the field.
 *
 * `shown` is the set of fields already established as asked. A condition
 * pointing at a field that isn't being asked — because it is switched off, was
 * deleted, or is itself hidden — fails rather than passing by default: an
 * orphaned condition means the branch it belonged to is gone.
 */
function conditionMet(
  condition: FormFieldDef["showWhen"] | null,
  values: Record<string, unknown>,
  shown: Set<string>,
): boolean {
  if (!condition || !condition.field) return true;
  if (!shown.has(condition.field)) return false;
  const answer = values[condition.field];
  const given = Array.isArray(answer)
    ? answer.map((v) => String(v))
    : [String(answer ?? "")];
  return given.some((v) => condition.values.includes(v));
}

/** The field carrying a given mapping, or null. */
export function fieldFor(
  form: ResolvedForm,
  mapping: FormFieldDef["mapping"],
): FormFieldDef | null {
  return visibleFields(form).find((f) => f.mapping === mapping) ?? null;
}

/**
 * Substitutes the tokens the copy and brief templates support — `{project}` on
 * the development dialogs, which have no master page to carry a heading, and
 * `{fieldKey}` in a brief prefix.
 *
 * `{token|fallback}` supplies the wording for the empty case, which the
 * off-plan brief needs: an unanswered project dropdown has to read "Not sure
 * yet" in the advisor's inbox, not as a blank or as a leftover `{project}`.
 * An unknown token with no fallback is left alone rather than blanked, so a
 * typo reads as a typo instead of quietly eating a sentence.
 */
export function renderFormCopy(
  value: string | null,
  tokens: Record<string, string | null | undefined>,
): string | null {
  if (!value) return value;
  return value.replace(
    /\{(\w+)(?:\|([^}]*))?\}/g,
    (whole, name: string, fallback: string | undefined) => {
      const replacement = tokens[name];
      if (replacement != null && replacement !== "") return replacement;
      if (fallback !== undefined) return fallback;
      return whole;
    },
  );
}
