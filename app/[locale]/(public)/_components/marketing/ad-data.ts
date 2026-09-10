/**
 * Final editorial copy transcribed from the client's master-page handoff
 * (design_handoff_bazar_master_pages). Shared across the Buy / Rent /
 * New Projects / Communities master pages. Reuse `lib/seeds/areas` where a
 * live entity/slug is needed; this holds the design's descriptive copy.
 */

import type { AreaRow } from "./area-list";

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
    "View off-plan apartments",
  ],
  [
    "Villas",
    "Explore spacious villas designed for privacy, comfort, and long-term family living.",
    "View off-plan villas",
  ],
  [
    "Townhouses",
    "Find contemporary townhouses built around community living and everyday convenience.",
    "View off-plan townhouses",
  ],
  [
    "Penthouses",
    "Discover exclusive penthouses with premium views, spacious layouts, and elevated living.",
    "View off-plan penthouses",
  ],
  [
    "Branded Residences",
    "Premium residences created with globally recognised lifestyle and hospitality brands.",
    "View branded residences",
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
export const AD_AREAS: AdArea[] = [
  {
    num: 1,
    slug: "saadiyat-island",
    name: "Saadiyat Island",
    name_ar: null,
    tagline:
      "One of Abu Dhabi's most prestigious island destinations — luxury living, culture, and beachfront communities.",
    tagline_ar: null,
    about:
      "Home to world-class museums, luxury resorts, beachfront residences, and premium villa communities. A refined living experience with strong long-term value.",
    about_ar: null,
  },
  {
    num: 2,
    slug: "al-reem-island",
    name: "Al Reem Island",
    name_ar: null,
    tagline:
      "A vibrant waterfront community offering modern apartments, strong rental demand, and city connectivity.",
    tagline_ar: null,
    about:
      "Popular among professionals, families, and investors. High-rise apartments, waterfront views, retail, schools, and proximity to the city centre.",
    about_ar: null,
  },
  {
    num: 3,
    slug: "yas-island",
    name: "Yas Island",
    name_ar: null,
    tagline:
      "A lifestyle destination built around entertainment, family living, and long-term investment appeal.",
    tagline_ar: null,
    about:
      "Combines residential communities with leisure, hospitality, and retail. Apartments, villas, townhouses, and new developments for end-users and investors.",
    about_ar: null,
  },
  {
    num: 4,
    slug: "al-maryah",
    name: "Al Maryah Island",
    name_ar: null,
    tagline:
      "Abu Dhabi's premium business and lifestyle district — luxury residences, dining, retail, and financial hubs.",
    tagline_ar: null,
    about:
      "A modern mixed-use destination known for its business district, waterfront setting, and proximity to ADGM. Ideal for professionals and investors.",
    about_ar: null,
  },
  {
    num: 5,
    slug: "al-raha",
    name: "Al Raha Beach",
    name_ar: null,
    tagline:
      "Waterfront living with established communities, sea views, and convenient access across Abu Dhabi.",
    tagline_ar: null,
    about:
      "Apartments, villas, retail and dining between the city and Yas Island — attractive for relaxed, connected waterfront living.",
    about_ar: null,
  },
  {
    num: 6,
    slug: "khalifa-city",
    name: "Khalifa City",
    name_ar: null,
    tagline:
      "A family-focused residential area offering spacious homes, convenience, and strong community appeal.",
    tagline_ar: null,
    about:
      "Well-established, known for villas, schools, and easy access to major roads. Popular with families seeking larger homes and a quieter lifestyle.",
    about_ar: null,
  },
  {
    num: 7,
    slug: "hudayriyat-island",
    name: "Hudayriyat Island",
    name_ar: null,
    tagline:
      "One of Abu Dhabi's rising lifestyle destinations, shaped around waterfront living and wellness.",
    tagline_ar: null,
    about:
      "An emerging destination with major residential, leisure and lifestyle developments — one of Abu Dhabi's most exciting areas for future growth.",
    about_ar: null,
  },
  {
    num: 8,
    slug: "masdar-city",
    name: "Masdar City",
    name_ar: null,
    tagline:
      "A sustainable urban community offering modern homes, smart design, and investment potential.",
    tagline_ar: null,
    about:
      "Known for sustainability-focused planning and modern apartments, attracting buyers looking for innovative, future-focused living.",
    about_ar: null,
  },
];
