/**
 * The badge a listing card wears — one implementation, for the six surfaces
 * that each had their own.
 *
 * `/`, `/areas/<slug>`, `/agents/<slug>`, the curated routes and the search
 * results all render `ListingCardPriced`, and each one carried a private
 * `badgeFor(row)` returning the English literals "Exclusive" and "Vacant on
 * transfer". Five copies of eight lines is a maintenance smell on its own; it
 * became a bug when `/ar` shipped, because every one of them is a word on a
 * card under `lang="ar"`.
 *
 * G-13 never reported any of them. The strings sit in a RETURNED OBJECT
 * LITERAL, which is neither a JSX text node nor one of the word-props the
 * guard scans — the blind spot its own header calls a floor. Five surfaces,
 * two words each, invisible to the instrument built to find exactly this.
 *
 * ## Why labels are passed in
 *
 * The obvious shape is for this module to read the catalogue itself. It
 * cannot: half the callers are Server Components reaching for
 * `getTranslations` and half of the rest sit at module scope, where no
 * translator is in lexical scope at all. Taking the words as an argument is
 * what lets one function serve both, and keeps this module free of a
 * next-intl import — so a unit test can call it with two strings.
 *
 * The words themselves live in `listing.badge.*` and nowhere else. They are
 * already there, the cards already read them, and a second copy under another
 * namespace would give one English string two Arabic renderings — which
 * `messages.test.ts` refuses outright.
 */

/** Only the two flags that produce a badge. Structural, so this module does
 *  not depend on the query layer's row type. */
export type ListingBadgeFlags =
  | {
      exclusive?: boolean | null;
      vacant_on_transfer?: boolean | null;
    }
  | null
  | undefined;

export type ListingBadgeLabels = {
  exclusive: string;
  vacantOnTransfer: string;
};

export type ListingBadge = { label: string; kind: "ink" | "accent" };

/**
 * Exclusive wins over vacant-on-transfer.
 *
 * Not an arbitrary tie-break: the card has room for one badge, and every one
 * of the five copies this replaces ordered them the same way. Preserved
 * rather than reconsidered — the point here is to stop five things drifting,
 * not to change what any of them shows.
 */
export function listingBadge(
  flags: ListingBadgeFlags,
  labels: ListingBadgeLabels,
): ListingBadge | undefined {
  if (flags?.exclusive) return { label: labels.exclusive, kind: "ink" };
  if (flags?.vacant_on_transfer)
    return { label: labels.vacantOnTransfer, kind: "accent" };
  return undefined;
}
