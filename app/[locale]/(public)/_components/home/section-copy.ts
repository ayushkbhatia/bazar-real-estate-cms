/**
 * Copy overrides passed down from the master-page editor. Every field is
 * optional: a section that isn't given one keeps the literal it ships with.
 */
export type SectionCopy = {
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

/**
 * How many records each home section renders when its list hasn't been
 * curated. The admin's "load what's on the page" seed reads these too, so the
 * editor starts from exactly what the page shows.
 */
export const HOME_OFFPLAN_CARD_COUNT = 3;
export const HOME_AREA_TILE_COUNT = 8;
export const HOME_FEATURED_LISTING_COUNT = 6;
