/**
 * The eight labels the hero search bar owns, in one place.
 *
 * Same inversion as `lib/forms/copy-keys.ts`, and for the same reason: the
 * TypeScript type, the zod schema, the merge and the save payload would
 * otherwise each hand-list the names, and nothing would force them to agree.
 * Missing a key does not error — it silently stops saving, and on a bag that
 * is REPLACED rather than merged that means destroying the editor's Arabic.
 *
 * ## Why every default is null
 *
 * Each of these already has an English string and a reviewed Arabic one in the
 * message catalogue (`messages/{en,ar}/search.json`). Copying those into a
 * registry default would fork them: two writable copies of "Property type",
 * and whichever screen you opened second would appear to have lost your edit —
 * the exact bug `copyFromPage` exists to prevent on the forms side.
 *
 * So the registry default is *absence*, and absence means "ask the catalogue".
 * An editor who types nothing gets today's rendering byte for byte, in both
 * languages; an editor who types something overrides that one label on this
 * one bar, and clearing the box hands it back to the catalogue.
 */

/** The catalogue key a blank override falls back to, under `search.`. */
export const SEARCH_BAR_COPY_KEYS = [
  { key: "submit_label", message: "filters.search", max: 60 },
  { key: "pending_label", message: "filters.searching", max: 60 },
  { key: "type_label", message: "filters.propertyType", max: 60 },
  { key: "any_type_label", message: "filters.anyType", max: 60 },
  { key: "beds_label", message: "filters.bedrooms", max: 60 },
  { key: "any_beds_label", message: "filters.anyBeds", max: 60 },
  { key: "size_label", message: "filters.size", max: 60 },
  { key: "price_label", message: "filters.priceRange", max: 60 },
] as const;

export type SearchBarCopyKey = (typeof SEARCH_BAR_COPY_KEYS)[number]["key"];

/** `submit_label` → `submit_label_ar`. The same suffix everything else uses. */
export type SearchBarCopyArKey = `${SearchBarCopyKey}_ar`;

export function copyArKey(key: SearchBarCopyKey): SearchBarCopyArKey {
  return `${key}_ar`;
}

/** Every key a stored copy bag may hold, English and Arabic. */
export const SEARCH_BAR_COPY_ALL_KEYS: readonly string[] =
  SEARCH_BAR_COPY_KEYS.flatMap((k) => [k.key, copyArKey(k.key)]);

/** 1.5x the English cap, matching `copyArMax` on the forms side. */
export function copyArMax(max: number): number {
  return Math.ceil(max * 1.5);
}
