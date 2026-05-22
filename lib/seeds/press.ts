/**
 * Press release placeholders. Sprint 1 ships the page; production content
 * comes from the team. The Pages CMS (Sprint 7g) can replace this if a
 * dedicated `press_releases` table doesn't ship.
 */

export type SeedPressItem = {
  id: string;
  date: string;
  outlet: string;
  title: string;
  url: string;
  excerpt: string;
};

export const SEED_PRESS: SeedPressItem[] = [
  {
    id: "p-2026-04-arabian-business",
    date: "2026-04-12",
    outlet: "Arabian Business",
    title: "Bazar closes AED 240M off-market block on Saadiyat",
    url: "https://example.com/arabian-business-bazar-saadiyat-2026",
    excerpt:
      "The transaction — eight Mamsha apartments to a Riyadh-based family office — was completed without a public listing, illustrating the off-market deal flow that Bazar has built into a competitive moat.",
  },
  {
    id: "p-2026-03-the-national",
    date: "2026-03-04",
    outlet: "The National",
    title: "Twelve advisors. By design.",
    url: "https://example.com/the-national-bazar-twelve-advisors-2026",
    excerpt:
      "An interview with Bazar founder Rashid Bin Faris on why the firm caps its advisor headcount and turns work away.",
  },
  {
    id: "p-2025-11-cityscape",
    date: "2025-11-19",
    outlet: "Cityscape Abu Dhabi",
    title: "Bazar named Boutique Brokerage of the Year",
    url: "https://example.com/cityscape-2025-bazar-award",
    excerpt:
      "Award recognises firms under 25 advisors with a 5-year operational record and a measurable commitment to fiduciary-aligned practice.",
  },
  {
    id: "p-2025-09-property-monthly",
    date: "2025-09-02",
    outlet: "Property Monthly UAE",
    title: "Abu Dhabi's quiet luxury market — a Bazar field note",
    url: "https://example.com/property-monthly-quiet-luxury-2025",
    excerpt:
      "Senior advisor Mariam Al-Hashimi on the rising premium for off-market beachfront stock and the structural shift in Saadiyat liquidity since 2023.",
  },
  {
    id: "p-2025-06-bloomberg-me",
    date: "2025-06-22",
    outlet: "Bloomberg Middle East",
    title: "How a boutique Abu Dhabi broker beats the portals",
    url: "https://example.com/bloomberg-bazar-abu-dhabi-2025",
    excerpt:
      "Profile of Bazar's flat 1.5% advisory fee structure and its emphasis on advisor specialisation over property volume.",
  },
];
