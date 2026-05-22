/**
 * Placeholder developers for /developers and /developers/[slug] in Sprint 1.
 * Sprint 9 swaps to `developer_profiles` table queries (joined with the existing
 * `developers` table).
 *
 * `aldar` already exists in `supabase/seed.sql` — the seed page below
 * shows it alongside Modon, Bloom, IMKAN, Reportage so the directory has depth
 * before the DB layer adds the rest.
 */

export type SeedDeveloper = {
  slug: string;
  name: string;
  blurb: string;
  founded_year: number;
  headquarters: string;
  active_developments: number;
  total_handed_over_units: number;
  bio: string;
  flagship_developments: string[];
  awards: string[];
};

export const SEED_DEVELOPERS: SeedDeveloper[] = [
  {
    slug: "aldar",
    name: "Aldar Properties",
    blurb:
      "Abu Dhabi's largest master-developer. Built most of Yas, Saadiyat, and Al Raha.",
    founded_year: 1992,
    headquarters: "Abu Dhabi, UAE",
    active_developments: 14,
    total_handed_over_units: 38000,
    bio: "Aldar is Abu Dhabi's largest publicly listed real-estate developer and the firm behind Yas Island, Saadiyat Beach, Al Raha Beach, and Reem. Its portfolio spans master-planned communities, retail, and institutional assets.",
    flagship_developments: [
      "Mamsha Al Saadiyat",
      "Yas Acres",
      "Saadiyat Lagoons",
      "Hidd Al Saadiyat",
    ],
    awards: [
      "RICS Developer of the Year 2024",
      "Forbes Middle East Top 100 Listed Companies 2024",
    ],
  },
  {
    slug: "modon",
    name: "Modon Properties",
    blurb:
      "Government-backed developer behind Hudayriyat Island and South Bani Yas.",
    founded_year: 2007,
    headquarters: "Abu Dhabi, UAE",
    active_developments: 6,
    total_handed_over_units: 4200,
    bio: "Modon Properties leads the development of Hudayriyat Island, Reem Mall, and the Abu Dhabi Cruise Terminal. It focuses on government-led large-scale urban regeneration.",
    flagship_developments: [
      "Hudayriyat Island",
      "South Bani Yas",
      "Reem Mall",
    ],
    awards: ["Cityscape Abu Dhabi Best Mixed-Use Project 2023"],
  },
  {
    slug: "bloom",
    name: "Bloom Holding",
    blurb: "Education-led communities with a long-term schooling thesis.",
    founded_year: 2007,
    headquarters: "Abu Dhabi, UAE",
    active_developments: 4,
    total_handed_over_units: 3800,
    bio: "Bloom's signature is community development anchored by international schools — its Bloom Gardens and Bloom Living projects pair villa stock with an in-community education campus.",
    flagship_developments: ["Bloom Living", "Bloom Gardens", "Bloom Heights"],
    awards: [],
  },
  {
    slug: "imkan",
    name: "IMKAN Properties",
    blurb: "Niche operator with a design-led portfolio.",
    founded_year: 2018,
    headquarters: "Abu Dhabi, UAE",
    active_developments: 5,
    total_handed_over_units: 1900,
    bio: "IMKAN is the Abu Dhabi developer most often compared with Bahrain's Diyar — a smaller, more architecturally specific portfolio. Sheikha Salama Tower and AlJurf are its better-known addresses.",
    flagship_developments: ["AlJurf", "Sheikha Salama Tower", "Pixel"],
    awards: ["Architizer A+ Award · Mixed-Use 2022"],
  },
  {
    slug: "reportage",
    name: "Reportage Properties",
    blurb: "High-volume mid-market off-plan operator.",
    founded_year: 2014,
    headquarters: "Abu Dhabi, UAE",
    active_developments: 11,
    total_handed_over_units: 8500,
    bio: "Reportage is the volume player at the entry-investor end of the Abu Dhabi off-plan market. It announces, brokers, and delivers more affordable-segment units per year than any other private developer in the emirate.",
    flagship_developments: [
      "Diva at Yas Bay",
      "Verdes",
      "Vista 3",
    ],
    awards: [],
  },
  {
    slug: "q-properties",
    name: "Q Properties",
    blurb: "Reem-focused tower specialist.",
    founded_year: 2009,
    headquarters: "Abu Dhabi, UAE",
    active_developments: 3,
    total_handed_over_units: 2400,
    bio: "Q Properties built and operates the Reflection and Q-Garden towers on Al Reem. Strong on building-management quality post-handover — a differentiator advisors flag.",
    flagship_developments: ["Reflection", "Q-Garden", "Q-Lifestyle"],
    awards: [],
  },
];

export function getSeedDeveloperBySlug(slug: string): SeedDeveloper | null {
  return SEED_DEVELOPERS.find((d) => d.slug === slug) ?? null;
}
