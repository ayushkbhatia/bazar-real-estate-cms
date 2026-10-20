/**
 * Lifestyle tags — the classification a listing carries so a search (and,
 * later, a landing page per tag) can be filtered by it.
 *
 * The first four are the "Communities by lifestyle" groups the Areas menu
 * already uses; Branded residences is the fifth the client asked for
 * (19 Oct 2026). Stored in `properties.lifestyle_tags` (migration 0165), whose
 * CHECK holds exactly these ids — a new tag is an entry here AND a migration
 * widening that CHECK, in the same change.
 *
 * Not card labels (`lib/card-labels.ts`). Those are chips drawn over a
 * photograph, worded and coloured by the client; these are a search facet.
 * A listing can be "Luxury" for search without wearing a chip that says so.
 *
 * Pure module: imported by the filter parser, which `proxy.ts`-adjacent code
 * and tests use without a request scope.
 */

import type { Locale } from "@/lib/i18n/locales";

export const LIFESTYLE_TAGS = [
  "waterfront",
  "family_friendly",
  "luxury",
  "gated",
  "branded_residences",
] as const;

export type LifestyleTag = (typeof LIFESTYLE_TAGS)[number];

/** Display names, in menu order. Arabic follows the site's existing wording. */
export const LIFESTYLE_TAG_LABEL: Record<
  LifestyleTag,
  { en: string; ar: string }
> = {
  waterfront: { en: "Waterfront", ar: "على الواجهة المائية" },
  family_friendly: { en: "Family friendly", ar: "مناسب للعائلات" },
  luxury: { en: "Luxury", ar: "فاخر" },
  gated: { en: "Gated", ar: "مجمع مسوّر" },
  branded_residences: { en: "Branded residences", ar: "مساكن ذات علامات تجارية" },
};

export function isLifestyleTag(v: unknown): v is LifestyleTag {
  return (
    typeof v === "string" && (LIFESTYLE_TAGS as readonly string[]).includes(v)
  );
}

export function lifestyleTagLabel(tag: LifestyleTag, locale: Locale): string {
  return LIFESTYLE_TAG_LABEL[tag][locale === "ar" ? "ar" : "en"];
}

/**
 * Keep only known tags, deduplicated, in vocabulary order.
 *
 * Validated against the fixed list rather than a shape regex (as card labels
 * are): the column's CHECK would reject anything else, and a friendly drop
 * here beats a constraint error on save. Vocabulary order makes the stored
 * array canonical, so two editors ticking the same boxes write the same row.
 */
export function cleanLifestyleTags(raw: unknown): LifestyleTag[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",").map((s) => s.trim())
      : [];
  const picked = new Set(list.filter(isLifestyleTag));
  return LIFESTYLE_TAGS.filter((t) => picked.has(t));
}

/**
 * The search a "show me these" link opens: every sale listing carrying the
 * tag. `/buy/search` because that is where tagged stock lives — the tags sit
 * on sale rows (`buy` and `off_plan`, which that route's mode umbrella covers
 * both of) and on no rentals. Unprefixed: the locale-aware `Link` adds `/ar`.
 */
export function lifestyleSearchHref(tag: LifestyleTag): string {
  return `/buy/search?lifestyle=${tag}`;
}
