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
  schools: {
    name: string;
    curriculum: string;
    distance_km: number;
    /** T3-E cleanup: ADEK / KHDA inspection rating where published. */
    rating?:
      | "Outstanding"
      | "Very good"
      | "Good"
      | "Acceptable"
      | "Weak";
  }[];
  amenities: string[];
  similar_areas: string[];
  // T3-E additions — all optional so existing seeds without these fields
  // continue to render; the new sections drop quietly when missing.
  /** Time-to-destination chips: "Corniche · 14 min · car" etc. */
  commute_chips?: {
    label: string;
    minutes: number;
    mode: "car" | "metro" | "walk";
  }[];
  /** Editorial lifestyle prose — what the area actually feels like. */
  lifestyle_prose?: string;
  /** A handful of dining picks for the lifestyle strip. */
  dining_picks?: { name: string; kind: string; note: string }[];
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
      {
        name: "Cranleigh Abu Dhabi",
        curriculum: "British",
        distance_km: 0,
        rating: "Outstanding",
      },
      {
        name: "Redwood Montessori",
        curriculum: "Montessori",
        distance_km: 1.2,
        rating: "Very good",
      },
      {
        name: "NYU Abu Dhabi",
        curriculum: "University",
        distance_km: 2.4,
      },
    ],
    amenities: [
      "Saadiyat Beach Club",
      "Louvre Abu Dhabi",
      "Mamsha boardwalk",
      "Saadiyat Marina",
      "9-hole golf course",
    ],
    similar_areas: ["yas-island", "al-raha"],
    commute_chips: [
      { label: "Saadiyat Beach", minutes: 4, mode: "car" },
      { label: "Corniche", minutes: 14, mode: "car" },
      { label: "Galleria Mall", minutes: 12, mode: "car" },
      { label: "Abu Dhabi airport", minutes: 22, mode: "car" },
      { label: "Louvre Abu Dhabi", minutes: 7, mode: "car" },
    ],
    lifestyle_prose:
      "Quiet weekday mornings — the beach is genuinely empty most days. Things pick up Thursday evening, peak around Friday brunch (book Buddha Bar Beach a week ahead), then ease into a slower Saturday. The island feels lived-in rather than visited; weekend traffic is half what you'd see on Yas.",
    dining_picks: [
      {
        name: "Buddha Bar Beach",
        kind: "Asian / waterfront",
        note: "Friday brunch is the social anchor of the island.",
      },
      {
        name: "Niri",
        kind: "Japanese, Saadiyat Rotana",
        note: "Best omakase outside the city centre.",
      },
      {
        name: "Beach House",
        kind: "Mediterranean",
        note: "Sunday brunch with kids welcome — the family-friendly default.",
      },
      {
        name: "Cipriani",
        kind: "Italian, Yacht Club",
        note: "Special-occasion dinner. Make the reservation in advance.",
      },
    ],
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
      {
        name: "West Yas Academy",
        curriculum: "American",
        distance_km: 0.5,
        rating: "Outstanding",
      },
      {
        name: "SABIS Yas",
        curriculum: "American/UK",
        distance_km: 1.0,
        rating: "Very good",
      },
    ],
    amenities: [
      "Yas Mall",
      "Yas Marina",
      "Yas Beach",
      "Ferrari World",
      "Etihad Arena",
    ],
    similar_areas: ["saadiyat-island", "al-reem-island"],
    commute_chips: [
      { label: "Yas Mall", minutes: 4, mode: "car" },
      { label: "Yas Beach", minutes: 6, mode: "car" },
      { label: "Abu Dhabi airport", minutes: 15, mode: "car" },
      { label: "Corniche", minutes: 28, mode: "car" },
      { label: "Saadiyat", minutes: 18, mode: "car" },
    ],
    lifestyle_prose:
      "Loud where Saadiyat is quiet — F1 weekend turns the entire island into a concert venue, Yas Mall fills up Thursday evenings, and the marina restaurants run late. Daytime is still domestic and slow; the noise is concentrated at the entertainment cluster. If you want a 5-minute walk to a brunch spot but a 25-minute drive to a quiet beach, Yas is the trade.",
    dining_picks: [
      {
        name: "Bord Eau",
        kind: "French, Shangri-La",
        note: "The grown-up dinner option — high-touch service, no music.",
      },
      {
        name: "Aquarium",
        kind: "Seafood, Yas Marina",
        note: "Best on Friday afternoons facing the F1 paddock.",
      },
      {
        name: "Diablito",
        kind: "Tapas, Yas Marina",
        note: "Loud, casual, late. Reliable Saturday night spot.",
      },
    ],
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
      {
        name: "Repton Abu Dhabi",
        curriculum: "British",
        distance_km: 0.8,
        rating: "Outstanding",
      },
      {
        name: "Sorbonne University Abu Dhabi",
        curriculum: "University",
        distance_km: 1.4,
      },
    ],
    amenities: [
      "Reem Mall",
      "Boutik Mall",
      "Galleria Maryah",
      "Sun & Sky Towers",
    ],
    similar_areas: ["corniche", "yas-island"],
    commute_chips: [
      { label: "Corniche", minutes: 8, mode: "car" },
      { label: "Galleria Maryah", minutes: 3, mode: "car" },
      { label: "Reem Mall", minutes: 4, mode: "car" },
      { label: "Abu Dhabi airport", minutes: 30, mode: "car" },
      { label: "Saadiyat", minutes: 16, mode: "car" },
    ],
    lifestyle_prose:
      "Reem is the only Abu Dhabi address where you can walk to the supermarket and the office on the same morning. Density brings life — mid-week dinners stay busy, the building lobbies have neighbours who recognise each other. It's the closest the city has to a Manhattan rhythm, with Sun Tower brunches and a hum of weekday foot traffic that Saadiyat will never have.",
    dining_picks: [
      {
        name: "Rosso Sky Lounge",
        kind: "Italian, Sun & Sky Tower",
        note: "The penthouse view from 75 floors up — best at sunset.",
      },
      {
        name: "Maté",
        kind: "Argentinian, Reem Mall",
        note: "Surprisingly good for a mall steakhouse. Weekday lunch staple.",
      },
      {
        name: "Cafe Bateel",
        kind: "Café, Boutik Mall",
        note: "Where Reem residents work remotely on Tuesday mornings.",
      },
    ],
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
      {
        name: "Al Yasmina Academy",
        curriculum: "British",
        distance_km: 0.3,
        rating: "Outstanding",
      },
      {
        name: "GEMS American Academy",
        curriculum: "American",
        distance_km: 1.1,
        rating: "Very good",
      },
      {
        name: "Brighton College",
        curriculum: "British",
        distance_km: 2.0,
        rating: "Outstanding",
      },
    ],
    amenities: [
      "Al Raha Beach Hotel",
      "Al Raha Mall",
      "Khalifa University",
      "Yas Mall (10 min)",
    ],
    similar_areas: ["yas-island", "saadiyat-island"],
    commute_chips: [
      { label: "Abu Dhabi airport", minutes: 12, mode: "car" },
      { label: "Yas Mall", minutes: 10, mode: "car" },
      { label: "Khalifa University", minutes: 5, mode: "car" },
      { label: "Saadiyat", minutes: 22, mode: "car" },
      { label: "Corniche", minutes: 25, mode: "car" },
    ],
    lifestyle_prose:
      "Al Raha is where families settle when Saadiyat feels too quiet and Yas feels too loud. School-run mornings start early and traffic into Al Yasmina and Brighton College anchors the rhythm. Weekends are split between Al Raha Beach (less crowded than Saadiyat) and Yas across the bridge. The clubhouse pools see more weekday use than weekend — by Friday everyone's heading somewhere louder.",
    dining_picks: [
      {
        name: "Sevilo",
        kind: "Spanish, Al Raha Beach",
        note: "Sunday-night fixture. Reliable, never trendy.",
      },
      {
        name: "Boa Steakhouse",
        kind: "Steak, Al Raha Beach Hotel",
        note: "Where the corporate dinners happen.",
      },
      {
        name: "Sloboda",
        kind: "Mediterranean, Yas Acres",
        note: "Short drive across to Yas — worth it for the patio.",
      },
    ],
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
      {
        name: "British School Al Khubairat",
        curriculum: "British",
        distance_km: 2.1,
        rating: "Outstanding",
      },
      {
        name: "International Community School",
        curriculum: "American",
        distance_km: 2.4,
        rating: "Very good",
      },
    ],
    amenities: [
      "Corniche beach",
      "Emirates Palace",
      "Marina Mall",
      "Etihad Towers",
      "Abu Dhabi Mall",
    ],
    similar_areas: ["al-reem-island", "al-raha"],
    commute_chips: [
      { label: "Corniche beach", minutes: 2, mode: "walk" },
      { label: "Marina Mall", minutes: 6, mode: "car" },
      { label: "Etihad Towers", minutes: 4, mode: "car" },
      { label: "Saadiyat", minutes: 15, mode: "car" },
      { label: "Abu Dhabi airport", minutes: 30, mode: "car" },
    ],
    lifestyle_prose:
      "The Corniche is for people who still want to be in the city. Mornings are joggers and dog-walkers along the eight-kilometre promenade; evenings shift to families and the Friday-night crowd at Marina Mall. Stock skews older, so floor plates are bigger than the new towers on Reem — corner units with proper balconies still trade at a discount to anything new-build.",
    dining_picks: [
      {
        name: "Hakkasan Abu Dhabi",
        kind: "Chinese, Emirates Palace",
        note: "Still the room for an occasion dinner.",
      },
      {
        name: "Talea by Antonio Guida",
        kind: "Italian, Marina Mall",
        note: "Quiet enough for a serious lunch.",
      },
      {
        name: "Hoi An",
        kind: "Vietnamese, Shangri-La",
        note: "Best pho on the city side.",
      },
    ],
  },
];

export function getSeedAreaGuideBySlug(slug: string): SeedAreaGuide | null {
  return SEED_AREA_GUIDES.find((a) => a.slug === slug) ?? null;
}
