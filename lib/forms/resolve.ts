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
  const out = { ...def.copy };
  for (const key of Object.keys(out) as (keyof FormCopy)[]) {
    const value = stored[key];
    // `undefined` means "never saved" and falls back; an explicit null means
    // the editor cleared an optional string, and must survive the merge.
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

function mergeFields(
  def: FormDef,
  stored: StoredField[] | null,
): FormFieldDef[] {
  if (!stored || stored.length === 0) return def.fields.map((f) => ({ ...f }));

  const ordered = [...stored]
    .sort((a, b) => a.position - b.position)
    .map(({ position: _position, ...field }) => field);

  const byKey = new Map(ordered.map((f) => [f.key, f]));
  const missingLocked = def.fields.filter(
    (f) => f.locked && !byKey.has(f.key),
  );

  // Locked fields land back at their registry position where that position
  // still exists in the stored list, and at the end otherwise. Appending
  // blindly would drop a re-attached email box below the message box.
  if (missingLocked.length === 0) return ordered;

  const out = [...ordered];
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

/** Fields the public form actually renders, in order. */
export function visibleFields(form: ResolvedForm): FormFieldDef[] {
  return form.fields.filter((f) => f.enabled);
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
