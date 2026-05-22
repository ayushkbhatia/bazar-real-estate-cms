/**
 * Placeholder agents shipped in Sprint 1. Swapped for `lib/queries/agents.ts`
 * in Sprint 9 once the public-readable agents query lands.
 *
 * Shape mirrors the eventual `staff` row shape plus the optional bio/specialty
 * fields the public profile needs. Slug is the URL key — keep it stable.
 */

export type SeedAgent = {
  slug: string;
  display_name: string;
  title: string;
  brn: string;
  photo_initial: string;
  email: string;
  whatsapp: string;
  phone: string;
  languages: string[];
  specialties: string[];
  areas: string[];
  bio: string;
  years_in_market: number;
  closed_aed_lifetime: string;
  closed_qtd: number;
  pull_quote: string;
};

export const SEED_AGENTS: SeedAgent[] = [
  {
    slug: "mariam-al-hashimi",
    display_name: "Mariam Al-Hashimi",
    title: "Senior Advisor · Saadiyat & Yas",
    brn: "BRN-58219",
    photo_initial: "M",
    email: "mariam@bazar.ae",
    whatsapp: "+971501234567",
    phone: "+97125550001",
    languages: ["English", "Arabic", "French"],
    specialties: ["Beachfront", "Off-market", "Family relocation"],
    areas: ["saadiyat-island", "yas-island"],
    bio: "Twelve years working the Saadiyat curve, from the first Mamsha handovers through Nudra and Hidd Al Saadiyat. Mariam is the advisor families ask for when the deal needs to close quietly.",
    years_in_market: 12,
    closed_aed_lifetime: "AED 1.8B",
    closed_qtd: 7,
    pull_quote: "We don't show twenty units. We show two — and we know why.",
  },
  {
    slug: "omar-darwish",
    display_name: "Omar Darwish",
    title: "Senior Advisor · Reem & Maryah",
    brn: "BRN-58041",
    photo_initial: "O",
    email: "omar@bazar.ae",
    whatsapp: "+971501234568",
    phone: "+97125550002",
    languages: ["English", "Arabic"],
    specialties: ["High-rise", "Investment", "First-time buyer"],
    areas: ["al-reem-island", "corniche"],
    bio: "Built his book in the Reem 2010s tower wave. Omar is the second call after the first quote — he tells you what the building is actually like to live in, not just what the brochure says.",
    years_in_market: 9,
    closed_aed_lifetime: "AED 920M",
    closed_qtd: 4,
    pull_quote: "Half my closes are buyers I told to walk away the first time.",
  },
  {
    slug: "sarah-kazim",
    display_name: "Sarah Kazim",
    title: "Senior Advisor · Off-plan & Investment",
    brn: "BRN-58144",
    photo_initial: "S",
    email: "sarah@bazar.ae",
    whatsapp: "+971501234569",
    phone: "+97125550003",
    languages: ["English", "Arabic", "Urdu"],
    specialties: ["Off-plan", "Yield investment", "Foreign buyer"],
    areas: ["yas-island", "al-raha"],
    bio: "Sarah models the deal before she shows it. Her clients see a spreadsheet first, the property second. She closed the largest off-plan block transaction Bazar handled in 2025.",
    years_in_market: 7,
    closed_aed_lifetime: "AED 640M",
    closed_qtd: 9,
    pull_quote: "I'll send you the model. If the model doesn't work, I won't sell you the apartment.",
  },
  {
    slug: "khalid-al-zaabi",
    display_name: "Khalid Al-Zaabi",
    title: "Senior Advisor · Heritage estates",
    brn: "BRN-58302",
    photo_initial: "K",
    email: "khalid@bazar.ae",
    whatsapp: "+971501234570",
    phone: "+97125550004",
    languages: ["Arabic", "English"],
    specialties: ["Estates", "Family villas", "Generational holdings"],
    areas: ["al-raha", "corniche"],
    bio: "Khalid works the Al Raha and Khalifa City villa market that doesn't list. His database is twenty years of dinner-table relationships. If you're looking for a five-bed family villa nobody else has shown you, this is the call.",
    years_in_market: 17,
    closed_aed_lifetime: "AED 2.4B",
    closed_qtd: 3,
    pull_quote: "The right house for a family isn't an MLS query.",
  },
  {
    slug: "lina-haddad",
    display_name: "Lina Haddad",
    title: "Senior Advisor · Tenant & rental",
    brn: "BRN-58177",
    photo_initial: "L",
    email: "lina@bazar.ae",
    whatsapp: "+971501234571",
    phone: "+97125550005",
    languages: ["English", "Arabic", "Spanish"],
    specialties: ["Rent", "Relocation", "Diplomat & corporate"],
    areas: ["saadiyat-island", "al-reem-island", "corniche"],
    bio: "Lina runs the rent side of the practice. She's the advisor diplomats and senior expats keep on retainer — knows which buildings actually deliver on the brochure and which to avoid in August.",
    years_in_market: 6,
    closed_aed_lifetime: "AED 380M",
    closed_qtd: 11,
    pull_quote: "Tenants don't get the same advisor as buyers in most firms. That's a mistake.",
  },
  {
    slug: "rashid-bin-faris",
    display_name: "Rashid Bin Faris",
    title: "Managing Director",
    brn: "BRN-57001",
    photo_initial: "R",
    email: "rashid@bazar.ae",
    whatsapp: "+971501234572",
    phone: "+97125550000",
    languages: ["English", "Arabic"],
    specialties: ["Strategy", "Institutional", "Family office"],
    areas: ["saadiyat-island", "yas-island", "al-raha"],
    bio: "Rashid founded Bazar in 2018 after twelve years on the institutional side. He still personally handles the firm's family-office mandates and sits on every offer above AED 30M.",
    years_in_market: 22,
    closed_aed_lifetime: "AED 4.8B",
    closed_qtd: 2,
    pull_quote: "Twelve advisors. By design. We turn work away.",
  },
];

export function getSeedAgentBySlug(slug: string): SeedAgent | null {
  return SEED_AGENTS.find((a) => a.slug === slug) ?? null;
}

export function listSeedAgentsByArea(areaSlug: string): SeedAgent[] {
  return SEED_AGENTS.filter((a) => a.areas.includes(areaSlug));
}
