/**
 * The seven copy keys a form owns, in one place.
 *
 * ## Why this exists
 *
 * `FormCopy` is enumerated FIVE times in this codebase: the TypeScript type,
 * `formCopySchema`, `mergeCopy`'s loop, the payload `_actions.ts` builds on
 * save, and the editor's inputs. Every one is a hand-written list of the same
 * seven names, and nothing forces them to agree.
 *
 * That is already documented as a trap — `docs/I18N.md:139` warns that
 * "`_actions.ts` enumerates every copy key explicitly on write; miss one and
 * every save destroys that field's Arabic". Adding seven Arabic twins to five
 * hand-written lists is fourteen chances to get it wrong, and the failure is
 * silent: a missing key does not error, it just quietly stops saving.
 *
 * Master-page sections avoid this entirely by DERIVING their Arabic twins from
 * `FieldDef[]` (`lib/master-pages/twins.ts`). Forms cannot do the same, because
 * there is no runtime field list to derive from — `FormCopy` is a TypeScript
 * type and an object literal, and neither survives to runtime.
 *
 * So the direction is inverted instead: this array is the source, and the type,
 * the schema, the merge and the payload are all built from it. Adding an eighth
 * copy key means editing one line, and its Arabic twin comes along for free.
 */

export const FORM_COPY_KEYS = [
  { key: "title", optional: true, max: 160 },
  { key: "subtitle", optional: true, max: 400 },
  { key: "submit_label", optional: false, max: 60, blank: "The button needs a label" },
  { key: "pending_label", optional: false, max: 60, blank: "The sending state needs a label" },
  { key: "success_title", optional: false, max: 120, blank: "The confirmation needs a heading" },
  { key: "success_body", optional: false, max: 600, blank: "The confirmation needs a body" },
  { key: "consent_note", optional: true, max: 300 },
] as const;

export type FormCopyKey = (typeof FORM_COPY_KEYS)[number]["key"];

/** `title` → `title_ar`. The same suffix the master pages use. */
export type FormCopyArKey = `${FormCopyKey}_ar`;

export function copyArKey(key: FormCopyKey): FormCopyArKey {
  return `${key}_ar`;
}

/** Every key a stored copy bag may hold, English and Arabic. */
export const FORM_COPY_ALL_KEYS: readonly string[] = FORM_COPY_KEYS.flatMap(
  (k) => [k.key, copyArKey(k.key)],
);

/**
 * Arabic length allowance: 1.5x the English cap, matching `arMax` in
 * `lib/master-pages/twins.ts`. Arabic runs longer than English for the same
 * content often enough that reusing the English cap silently rejects a correct
 * translation — and a rejected translation is a field that stays English.
 */
export function copyArMax(max: number): number {
  return Math.ceil(max * 1.5);
}
