/**
 * The logo art that ships with the repo, resolved for one developer.
 *
 * The 30 launch partners carry their marks as PNGs in `/public/developers`,
 * not in the database — so the public profile drew a logo the CMS knew nothing
 * about, and the admin record showed an empty picker for every one of them.
 * This is the shared lookup that closes that gap: the admin renders it as the
 * developer's current logo, and an upload on the record overrides it.
 *
 * Matching is on slug **or** normalised name, for the same reason the public
 * directory merges that way — the catalogue rows and the shipped set disagree
 * about slugs (`modon` vs `modon-properties`).
 */

import { developerNameKey } from "@/lib/schemas/developer";
import { DEVELOPERS, type DeveloperDir } from "./directory-data";
import { trimmedLogo, type TrimmedLogo } from "./logos";

export type ShippedLogo = {
  /** Padding-cropped art — optically normalised, preferred where it exists. */
  trimmed: TrimmedLogo | null;
  /** The padded 600×600 master canvas every launch partner has. */
  master: { src: string; w: number; h: number };
  name: string;
};

/** The directory entry for a slug or name, or null when nothing ships for it. */
export function findShippedDeveloper(
  slugOrName: string,
): DeveloperDir | null {
  if (!slugOrName) return null;
  const bySlug = DEVELOPERS.find((d) => d.slug === slugOrName);
  if (bySlug) return bySlug;
  const key = developerNameKey(slugOrName);
  if (!key) return null;
  return DEVELOPERS.find((d) => developerNameKey(d.name) === key) ?? null;
}

/**
 * Shipped art for a developer, matched by slug first then by name.
 *
 * Pass both when you have them — a catalogue row's slug may not match the
 * shipped one, but its name usually does.
 */
export function shippedLogo(opts: {
  slug?: string | null;
  name?: string | null;
}): ShippedLogo | null {
  const dir =
    (opts.slug ? findShippedDeveloper(opts.slug) : null) ??
    (opts.name ? findShippedDeveloper(opts.name) : null);
  if (!dir) return null;
  return {
    trimmed: trimmedLogo(dir.slug) ?? null,
    master: { src: dir.logo, w: dir.w, h: dir.h },
    name: dir.name,
  };
}

/**
 * One `src`/`w`/`h` triple for a developer's logo, in the order surfaces
 * should prefer them: what an operator uploaded, then the trimmed shipped art,
 * then its padded master canvas. Null means "draw initials".
 *
 * Upload wins. It used to lose — which made the logo field on the record
 * editor a no-op for exactly the 30 developers most likely to need a refresh.
 */
export function resolveDeveloperLogo(opts: {
  uploadedUrl?: string | null;
  slug?: string | null;
  name?: string | null;
}): { src: string; w: number; h: number } | null {
  if (opts.uploadedUrl)
    return { src: opts.uploadedUrl, w: 240, h: 240 };
  const shipped = shippedLogo({ slug: opts.slug, name: opts.name });
  if (!shipped) return null;
  return shipped.trimmed ?? shipped.master;
}
