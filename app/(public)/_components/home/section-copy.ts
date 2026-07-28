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
