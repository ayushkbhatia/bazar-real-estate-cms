/**
 * Final editorial copy transcribed from the client's master-page handoff
 * (design_handoff_bazar_master_pages). Shared across the Buy / Rent /
 * New Projects / Communities master pages. Reuse `lib/seeds/areas` where a
 * live entity/slug is needed; this holds the design's descriptive copy.
 */

import type { AreaRow } from "./area-list";
import { OFFPLAN_COMMUNITY_ROWS } from "@/lib/master-pages/sections/offplan-communities";

/** The 8 communities the Buy/Rent chip clouds reference. */
export const AD_COMMUNITIES = [
  "Al Reem Island",
  "Yas Island",
  "Saadiyat Island",
  "Al Raha Beach",
  "Al Maryah Island",
  "Khalifa City",
  "Hudayriyat Island",
  "Masdar City",
] as const;

/** Property types for sale/rent — [name, description]. */
export const SALE_PROP_TYPES: [string, string][] = [
  [
    "Apartments",
    "Find modern apartments in prime Abu Dhabi communities, ideal for individuals, couples, families, and professionals.",
  ],
  [
    "Villas",
    "Explore spacious villas designed for family living, privacy, outdoor space, and long-term comfort.",
  ],
  [
    "Townhouses",
    "Discover townhouses that offer the perfect balance between space, community living, and everyday convenience.",
  ],
  [
    "Penthouses",
    "Browse premium penthouses with larger layouts, high-end finishes, and exceptional views.",
  ],
  [
    "Commercial Properties",
    "Find offices, retail spaces, and other commercial opportunities for your business.",
  ],
];

/** Off-plan property types (adds Branded Residences) — [name, desc, cta]. */
export const OFFPLAN_TYPES: [string, string, string][] = [
  [
    "Apartments",
    "Discover modern off-plan apartments in Abu Dhabi's most connected communities.",
    "View Off-Plan Apartments",
  ],
  [
    "Villas",
    "Explore spacious villas designed for privacy, comfort, and long-term family living.",
    "View Off-Plan Villas",
  ],
  [
    "Townhouses",
    "Find contemporary townhouses built around community living and everyday convenience.",
    "View Off-Plan Townhouses",
  ],
  [
    "Penthouses",
    "Discover exclusive penthouses with premium views, spacious layouts, and elevated living.",
    "View Off-Plan Penthouses",
  ],
  [
    "Branded Residences",
    "Premium residences created with globally recognised lifestyle and hospitality brands.",
    "View Branded Residences",
  ],
];

/**
 * One community as this file holds it: the editorial copy, plus the live
 * area's slug and three declared-but-empty Arabic twins.
 *
 * The twins are `null` on purpose rather than absent. `localiseRow` only
 * consults `ARABIC_STORE` for a key whose `_ar` twin EXISTS on the row — a
 * guard that stops it swapping an id or a slug for a coincidental store hit —
 * so a bag with no twin key never folds, however much Arabic the store holds.
 * Declaring them empty is how this const joins the site's Arabic without
 * carrying a second copy of it.
 */
export type AdArea = AreaRow & {
  /** The live `areas.slug`, which is what listing counts are matched on. */
  slug: string;
  name_ar: null;
  tagline_ar: null;
  about_ar: null;
};

/**
 * The 8 leading Abu Dhabi communities with full editorial descriptions, shared
 * by New Projects and Communities.
 *
 * Match on `slug` to overlay live listing counts from `listAreasWithCounts` —
 * NOT on `name`. Name matching failed twice over: "Al Raha Beach" is `al-raha`
 * in the catalogue and is named "Al Raha" there, so that row rendered with no
 * count at all; and under `/ar` the live names arrive already folded to Arabic,
 * so every one of the eight missed and the whole section lost its counts and
 * its area links.
 */
export const AD_AREAS: AdArea[] = OFFPLAN_COMMUNITY_ROWS.map((row, i) => ({
  num: i + 1,
  ...row,
  name_ar: null,
  tagline_ar: null,
  about_ar: null,
}));
