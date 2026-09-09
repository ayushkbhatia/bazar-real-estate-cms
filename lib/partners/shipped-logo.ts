/**
 * The logo art that ships with the repo, resolved for one partner card.
 *
 * The seven launch partners carry their marks as PNGs in `/public/partners`,
 * not in the media library — so a CMS card that nobody has uploaded a logo for
 * still has art to draw, and an un-edited site renders exactly what it rendered
 * before the cards became editable.
 *
 * Matching is on slug **or** normalised name, the same two-key rule
 * `lib/developers/shipped-logo.ts` uses and for the same reason: the stored
 * card and the shipped set can disagree about one of them. An editor who
 * renames "First Abu Dhabi Bank" to "FAB" keeps its logo because the card still
 * carries `slug: "fab"`; an editor who clears the slug keeps it as long as the
 * name still matches.
 */

import { slugify } from "@/lib/slug";
import { ECOSYSTEM_PARTNERS, type EcosystemPartner, type PartnerLogoArt } from "./directory-data";

/** Normalised lookup key for a partner name — "First Abu Dhabi Bank" → "first-abu-dhabi-bank". */
export function partnerNameKey(name: string): string {
  return slugify(name);
}

/** The shipped entry for a slug or a name, or null when nothing ships for it. */
export function findShippedPartner(slugOrName: string): EcosystemPartner | null {
  if (!slugOrName) return null;
  const bySlug = ECOSYSTEM_PARTNERS.find((p) => p.slug === slugOrName);
  if (bySlug) return bySlug;
  const key = partnerNameKey(slugOrName);
  if (!key) return null;
  return (
    ECOSYSTEM_PARTNERS.find((p) => partnerNameKey(p.name) === key) ?? null
  );
}

/** Shipped art for a partner, matched by slug first then by name. */
export function shippedPartnerLogo(opts: {
  slug?: string | null;
  name?: string | null;
}): PartnerLogoArt | null {
  const entry =
    (opts.slug ? findShippedPartner(opts.slug) : null) ??
    (opts.name ? findShippedPartner(opts.name) : null);
  return entry ? { src: entry.logo, w: entry.w, h: entry.h } : null;
}

/**
 * The dimensions an uploaded logo is declared with.
 *
 * `next/image` needs a width and a height, and an asset picked in the CMS
 * carries neither — `media_assets.width/height` are NULL for every row on this
 * site. Both surfaces that draw a logo fix its height in CSS and let the width
 * follow the loaded image's own ratio, so these are only the placeholder ratio
 * used before it loads. Square, like the developer records use.
 */
export const UPLOADED_LOGO_DIMS = { w: 240, h: 240 } as const;

/**
 * One `src`/`w`/`h` triple for a partner's logo, in the order surfaces should
 * prefer them: what an editor uploaded, then the shipped art. Null means the
 * card has no logo at all and should draw the institution's name instead.
 *
 * Upload wins, deliberately. A logo field that loses to shipped art is a no-op
 * for exactly the seven partners most likely to need a refresh — the mistake
 * `resolveDeveloperLogo` documents having made.
 */
export function resolvePartnerLogo(opts: {
  uploadedUrl?: string | null;
  slug?: string | null;
  name?: string | null;
}): PartnerLogoArt | null {
  if (opts.uploadedUrl)
    return { src: opts.uploadedUrl, ...UPLOADED_LOGO_DIMS };
  return shippedPartnerLogo({ slug: opts.slug, name: opts.name });
}
