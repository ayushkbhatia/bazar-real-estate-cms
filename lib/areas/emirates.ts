/**
 * The two emirates the map covers, and where their names live.
 *
 * Three separate components had their own `[{slug, label}]` literal — the home
 * map's toggle, the Buy landing's map, and the area detail card inside the map
 * itself. All three read "Abu Dhabi" and "Dubai" in English on /ar, and each
 * would have had to be found and fixed on its own.
 *
 * The names are proper nouns with one approved Arabic each
 * (`lib/i18n/mt/proper-nouns.ts`), so they belong in the message catalogue
 * rather than in a database column: there is nothing for an editor to decide,
 * and a per-row twin would be a second place for the answer to disagree.
 *
 * `common` rather than a route-scoped namespace because two of the three
 * consumers are Client Components and the third is on a different route — two
 * keys is the cheapest correct answer.
 */

export const EMIRATE_SLUGS = ["abu-dhabi", "dubai"] as const;

export type EmirateSlug = (typeof EMIRATE_SLUGS)[number];

/** `abu-dhabi` → `emirates.abuDhabi`, a key under the `common` namespace. */
export function emirateMessageKey(slug: string): string {
  return slug === "dubai" ? "emirates.dubai" : "emirates.abuDhabi";
}
