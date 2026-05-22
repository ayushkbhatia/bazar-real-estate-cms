/**
 * Area guide content overlay for the 6 areas already in `supabase/seed.sql`.
 * Sprint 1 reads the area slug from the URL and pulls the guide here.
 * Sprint 8 introduces `area_guides` table; Sprint 9 swaps to a DB query.
 *
 * Keep slugs in lockstep with `supabase/seed.sql` lines 14–24.
 */

export type SeedAreaGuide = {
  slug: string;
  name: string;
  hero_label: string;
  intro: string;
  position: string;
  vibe: string;
  stats: {
    median_apt_aed_per_ft2: number;
    median_villa_aed_per_ft2: number;
    avg_dom_days: number;
    yoy_change_pct: number;
  };
  schools: { name: string; curriculum: string; distance_km: number }[];
  amenities: string[];
  similar_areas: string[];
};

export const SEED_AREA_GUIDES: SeedAreaGuide[] = [
  {
    slug: "saadiyat-island",
    name: "Saadiyat Island",
    hero_label: "saadiyat-island",
    intro:
      "Saadiyat is the cultural island — home to the Louvre Abu Dhabi, the upcoming Guggenheim, and a 9-km stretch of unbuilt-on beach. Stock is a mix of Mamsha apartments, Hidd waterfront villas, and the Nudra cluster.",
    position: "11 km from Corniche, 20 minutes to airport",
    vibe: "Beachfront, low-density, family",
    stats: {
      median_apt_aed_per_ft2: 1980,
      median_villa_aed_per_ft2: 2640,
      avg_dom_days: 47,
      yoy_change_pct: 8.4,
    },
    schools: [
      { name: "Cranleigh Abu Dhabi", curriculum: "British", distance_km: 0 },
      { name: "Redwood Montessori", curriculum: "Montessori", distance_km: 1.2 },
      { name: "NYU Abu Dhabi", curriculum: "University", distance_km: 2.4 },
    ],
    amenities: [
      "Saadiyat Beach Club",
      "Louvre Abu Dhabi",
      "Mamsha boardwalk",
      "Saadiyat Marina",
      "9-hole golf course",
    ],
    similar_areas: ["yas-island", "al-raha"],
  },
  {
    slug: "yas-island",
    name: "Yas Island",
    hero_label: "yas-island",
    intro:
      "Yas is the entertainment island. Ferrari World, Yas Marina Circuit, Yas Waterworld, and Yas Mall sit alongside Yas Acres, Mayan, and the new Yas Bay residential stock.",
    position: "25 km from Corniche, 15 minutes to airport",
    vibe: "Lifestyle-led, mid-density, all ages",
    stats: {
      median_apt_aed_per_ft2: 1480,
      median_villa_aed_per_ft2: 1820,
      avg_dom_days: 38,
      yoy_change_pct: 11.2,
    },
    schools: [
      { name: "West Yas Academy", curriculum: "American", distance_km: 0.5 },
      { name: "SABIS Yas", curriculum: "American/UK", distance_km: 1.0 },
    ],
    amenities: [
      "Yas Mall",
      "Yas Marina",
      "Yas Beach",
      "Ferrari World",
      "Etihad Arena",
    ],
    similar_areas: ["saadiyat-island", "al-reem-island"],
  },
  {
    slug: "al-reem-island",
    name: "Al Reem Island",
    hero_label: "al-reem-island",
    intro:
      "Reem is the mid-island skyline — high-rise towers, schools, retail, and a five-minute crossing to downtown. The newest waterfront stock sits in Marina Square and Shams Abu Dhabi.",
    position: "3 km from Corniche, 28 minutes to airport",
    vibe: "Urban, high-rise, mid-income to executive",
    stats: {
      median_apt_aed_per_ft2: 1310,
      median_villa_aed_per_ft2: 0,
      avg_dom_days: 33,
      yoy_change_pct: 6.1,
    },
    schools: [
      { name: "Repton Abu Dhabi", curriculum: "British", distance_km: 0.8 },
      { name: "Sorbonne University Abu Dhabi", curriculum: "University", distance_km: 1.4 },
    ],
    amenities: [
      "Reem Mall",
      "Boutik Mall",
      "Galleria Maryah",
      "Sun & Sky Towers",
    ],
    similar_areas: ["corniche", "yas-island"],
  },
  {
    slug: "al-raha",
    name: "Al Raha",
    hero_label: "al-raha",
    intro:
      "Al Raha is the mainland family suburb — established communities like Al Raha Gardens and Al Raha Beach, plus the newer Khalifa City expansions. Anchored by major schools and the Khalifa University corridor.",
    position: "20 km from Corniche, 12 minutes to airport",
    vibe: "Suburban, low-density, family",
    stats: {
      median_apt_aed_per_ft2: 1180,
      median_villa_aed_per_ft2: 1420,
      avg_dom_days: 52,
      yoy_change_pct: 5.7,
    },
    schools: [
      { name: "Al Yasmina Academy", curriculum: "British", distance_km: 0.3 },
      { name: "GEMS American Academy", curriculum: "American", distance_km: 1.1 },
      { name: "Brighton College", curriculum: "British", distance_km: 2.0 },
    ],
    amenities: [
      "Al Raha Beach Hotel",
      "Al Raha Mall",
      "Khalifa University",
      "Yas Mall (10 min)",
    ],
    similar_areas: ["yas-island", "saadiyat-island"],
  },
  {
    slug: "corniche",
    name: "Corniche",
    hero_label: "corniche",
    intro:
      "The eight-kilometre Corniche promenade and the older Abu Dhabi addresses that face it. Stock is a mix of refreshed 1990s towers, newer high-rises, and the Capital Plaza low-rises.",
    position: "Downtown, 30 minutes to airport",
    vibe: "Established, central, mixed-density",
    stats: {
      median_apt_aed_per_ft2: 1240,
      median_villa_aed_per_ft2: 0,
      avg_dom_days: 41,
      yoy_change_pct: 3.4,
    },
    schools: [
      { name: "British School Al Khubairat", curriculum: "British", distance_km: 2.1 },
      { name: "International Community School", curriculum: "American", distance_km: 2.4 },
    ],
    amenities: [
      "Corniche beach",
      "Emirates Palace",
      "Marina Mall",
      "Etihad Towers",
      "Abu Dhabi Mall",
    ],
    similar_areas: ["al-reem-island", "al-raha"],
  },
];

export function getSeedAreaGuideBySlug(slug: string): SeedAreaGuide | null {
  return SEED_AREA_GUIDES.find((a) => a.slug === slug) ?? null;
}
