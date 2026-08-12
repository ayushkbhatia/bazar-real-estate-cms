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
 * The 8 leading Abu Dhabi communities with full editorial descriptions, shared
 * by New Projects and Communities. Match on `name` to overlay live listing
 * counts from `listAreasWithCounts`.
 */
export const AD_AREAS: AreaRow[] = [
  {
    num: 1,
    name: "Saadiyat Island",
    tagline:
      "One of Abu Dhabi's most prestigious island destinations — luxury living, culture, and beachfront communities.",
    about:
      "Home to world-class museums, luxury resorts, beachfront residences, and premium villa communities. A refined living experience with strong long-term value.",
  },
  {
    num: 2,
    name: "Al Reem Island",
    tagline:
      "A vibrant waterfront community offering modern apartments, strong rental demand, and city connectivity.",
    about:
      "Popular among professionals, families, and investors. High-rise apartments, waterfront views, retail, schools, and proximity to the city centre.",
  },
  {
    num: 3,
    name: "Yas Island",
    tagline:
      "A lifestyle destination built around entertainment, family living, and long-term investment appeal.",
    about:
      "Combines residential communities with leisure, hospitality, and retail. Apartments, villas, townhouses, and new developments for end-users and investors.",
  },
  {
    num: 4,
    name: "Al Maryah Island",
    tagline:
      "Abu Dhabi's premium business and lifestyle district — luxury residences, dining, retail, and financial hubs.",
    about:
      "A modern mixed-use destination known for its business district, waterfront setting, and proximity to ADGM. Ideal for professionals and investors.",
  },
  {
    num: 5,
    name: "Al Raha Beach",
    tagline:
      "Waterfront living with established communities, sea views, and convenient access across Abu Dhabi.",
    about:
      "Apartments, villas, retail and dining between the city and Yas Island — attractive for relaxed, connected waterfront living.",
  },
  {
    num: 6,
    name: "Khalifa City",
    tagline:
      "A family-focused residential area offering spacious homes, convenience, and strong community appeal.",
    about:
      "Well-established, known for villas, schools, and easy access to major roads. Popular with families seeking larger homes and a quieter lifestyle.",
  },
  {
    num: 7,
    name: "Hudayriyat Island",
    tagline:
      "One of Abu Dhabi's rising lifestyle destinations, shaped around waterfront living and wellness.",
    about:
      "An emerging destination with major residential, leisure and lifestyle developments — one of Abu Dhabi's most exciting areas for future growth.",
  },
  {
    num: 8,
    name: "Masdar City",
    tagline:
      "A sustainable urban community offering modern homes, smart design, and investment potential.",
    about:
      "Known for sustainability-focused planning and modern apartments, attracting buyers looking for innovative, future-focused living.",
  },
];
