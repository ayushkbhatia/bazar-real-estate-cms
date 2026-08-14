/**
 * Community names reduced to a comparison key, with the generic tail removed.
 *
 * The area guide's communities band leads with cards for the published
 * projects in that area and follows with the CMS's editorial community list.
 * The two systems name the same place differently — "Al Naseem Community"
 * against the project "Al Naseem", "Bashayer" against "Bashayer Residences",
 * "Hudayriyat Golf Estates" against "Hudayriyat Golf Estate" — so the list has
 * to be deduped against the cards by something looser than equality.
 *
 * Stripping the trailing generic word from both sides and then comparing
 * *exactly* catches those without the false positives a prefix or substring
 * match would produce: on Hudayriyat alone, a prefix match would collapse
 * Nawayef Village, Nawayef Park Views and Nawayef East into one.
 */
const GENERIC_TAIL =
  /\s+(community|communities|residences?|estates?|villages?|villas?|towers?|apartments?|gardens?)$/i;

export function communityKey(name: string): string {
  let out = name.trim();
  // Twice, so a doubled tail ("Fahid Beach Residences") also reduces.
  for (let i = 0; i < 2; i++) out = out.replace(GENERIC_TAIL, "");
  // Letters and digits of ANY script, not just `[a-z0-9]`.
  //
  // This was `/[^a-z0-9]/g`, which is a landmine rather than a bug only
  // because `LOCALES` is still `["en"]`. Both inputs to this function are
  // already folded — `developments.name` at developments.ts:159 and the
  // editorial item's name through the section choke point — so on /ar both
  // arrive in Arabic, every character is outside `[a-z0-9]`, and EVERY name
  // reduces to the empty string. `shownProjectKeys` collapses to `{""}`, that
  // one key matches every editorial entry, and the whole communities band on
  // /areas/<slug> is dropped as duplicates.
  //
  // For Latin input the result is unchanged — `\p{L}` contains a-z and `\p{N}`
  // contains 0-9, and the string is already lower-cased. The one difference is
  // that accented Latin now survives ("café" instead of "caf"), which is also
  // the more correct answer.
  return out.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
