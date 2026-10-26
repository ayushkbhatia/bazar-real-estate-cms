/**
 * The communities the New Projects page lists under "Explore Abu Dhabi's leading
 * communities": the shipped rows, which the off-plan master page's Locations
 * section takes as its defaults (Pages & blocks → New Projects → Locations).
 *
 * Lives in lib so the master-page registry can read it; the marketing data
 * module re-exports it as `AD_AREAS`. `slug` is the live `areas.slug` a row's
 * link narrows the off-plan search to. The Arabic comes from the shared store
 * (keyed by these English strings), so it holds after an editor saves the list.
 */
export type OffplanCommunityRow = {
  slug: string;
  name: string;
  tagline: string;
  about: string;
};

export const OFFPLAN_COMMUNITY_ROWS: OffplanCommunityRow[] = [
  {
    slug: "saadiyat-island",
    name: "Saadiyat Island",
    tagline:
      "One of Abu Dhabi's most prestigious island destinations — luxury living, culture, and beachfront communities.",
    about:
      "Home to world-class museums, luxury resorts, beachfront residences, and premium villa communities. A refined living experience with strong long-term value.",
  },
  {
    slug: "al-reem-island",
    name: "Al Reem Island",
    tagline:
      "A vibrant waterfront community offering modern apartments, strong rental demand, and city connectivity.",
    about:
      "Popular among professionals, families, and investors. High-rise apartments, waterfront views, retail, schools, and proximity to the city centre.",
  },
  {
    slug: "yas-island",
    name: "Yas Island",
    tagline:
      "A lifestyle destination built around entertainment, family living, and long-term investment appeal.",
    about:
      "Combines residential communities with leisure, hospitality, and retail. Apartments, villas, townhouses, and new developments for end-users and investors.",
  },
  {
    slug: "al-maryah",
    name: "Al Maryah Island",
    tagline:
      "Abu Dhabi's premium business and lifestyle district — luxury residences, dining, retail, and financial hubs.",
    about:
      "A modern mixed-use destination known for its business district, waterfront setting, and proximity to ADGM. Ideal for professionals and investors.",
  },
  {
    slug: "al-raha",
    name: "Al Raha Beach",
    tagline:
      "Waterfront living with established communities, sea views, and convenient access across Abu Dhabi.",
    about:
      "Apartments, villas, retail and dining between the city and Yas Island — attractive for relaxed, connected waterfront living.",
  },
  {
    slug: "khalifa-city",
    name: "Khalifa City",
    tagline:
      "A family-focused residential area offering spacious homes, convenience, and strong community appeal.",
    about:
      "Well-established, known for villas, schools, and easy access to major roads. Popular with families seeking larger homes and a quieter lifestyle.",
  },
  {
    slug: "hudayriyat-island",
    name: "Hudayriyat Island",
    tagline:
      "One of Abu Dhabi's rising lifestyle destinations, shaped around waterfront living and wellness.",
    about:
      "An emerging destination with major residential, leisure and lifestyle developments — one of Abu Dhabi's most exciting areas for future growth.",
  },
  {
    slug: "masdar-city",
    name: "Masdar City",
    tagline:
      "A sustainable urban community offering modern homes, smart design, and investment potential.",
    about:
      "Known for sustainability-focused planning and modern apartments, attracting buyers looking for innovative, future-focused living.",
  },
];
