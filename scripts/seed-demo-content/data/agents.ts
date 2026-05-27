/**
 * Twelve advisors for /agents and /agents/[slug].
 *
 * The first six slugs match `lib/seeds/agents.ts` exactly so the
 * WhatsApp deep-link fallback (which keys off slug) keeps working
 * after the seeder runs.
 *
 * Voice: editorial, numerically honest, slightly contrarian. No hype,
 * no emoji, no superlatives. Each bio is a profile of someone who has
 * actually done the work.
 *
 * Photo URLs are intentionally null at seed time — the assets-manifest
 * supplies them post-Bazar-photography-delivery. Until then, /agents
 * renders PlaceholderImage tiles.
 */

export type AgentSeed = {
  /** Becomes both the email-local-part and the auth.users email. */
  email_local: string;
  /** URL slug — stable, do not change after launch. */
  slug: string;
  display_name: string;
  /** Drives the desk grouping via `lib/agents/desk.ts`. */
  title: string;
  /** Real BRN format placeholder. Client swaps for Bazar's actual BRNs. */
  brn: string;
  /** ISO-3166-style language list, jsonb on the staff row. */
  languages: string[];
  specialties: string[];
  /** Optional industry credentials shown on the profile. */
  credentials: string[];
  /** 2-3 sentence editorial bio. */
  bio: string;
  /** YYYY-MM-DD; varies so the team page doesn't look batch-created. */
  joined_at: string;
};

export const AGENTS: AgentSeed[] = [
  // ─── Leadership ──────────────────────────────────────────────
  {
    email_local: "rashid",
    slug: "rashid-bin-faris",
    display_name: "Rashid Bin Faris",
    title: "Managing Director",
    brn: "BRN-57001",
    languages: ["English", "Arabic"],
    specialties: ["Strategy", "Institutional", "Family office"],
    credentials: ["MRICS", "RERA certified"],
    bio: "Rashid founded Bazar in 2018 after twelve years on the institutional side. He still personally handles the firm's family-office mandates and sits on every offer above AED 30M.",
    joined_at: "2018-03-01",
  },

  // ─── Buy-side ────────────────────────────────────────────────
  {
    email_local: "mariam",
    slug: "mariam-al-hashimi",
    display_name: "Mariam Al-Hashimi",
    title: "Senior Advisor · Saadiyat & Yas",
    brn: "BRN-58219",
    languages: ["English", "Arabic", "French"],
    specialties: ["Beachfront", "Off-market", "Family relocation"],
    credentials: ["RERA certified", "CIPS"],
    bio: "Twelve years working the Saadiyat curve, from the first Mamsha handovers through Nudra and Hidd Al Saadiyat. Mariam is the advisor families ask for when the deal needs to close quietly.",
    joined_at: "2019-06-15",
  },
  {
    email_local: "omar",
    slug: "omar-darwish",
    display_name: "Omar Darwish",
    title: "Senior Advisor · Reem & Maryah",
    brn: "BRN-58041",
    languages: ["English", "Arabic"],
    specialties: ["High-rise", "Investment", "First-time buyer"],
    credentials: ["RERA certified"],
    bio: "Built his book in the Reem 2010s tower wave. Omar is the second call after the first quote — he tells you what the building is actually like to live in, not just what the brochure says.",
    joined_at: "2020-01-12",
  },
  {
    email_local: "khalid",
    slug: "khalid-al-zaabi",
    display_name: "Khalid Al-Zaabi",
    title: "Senior Advisor · Heritage estates",
    brn: "BRN-58302",
    languages: ["Arabic", "English"],
    specialties: ["Estates", "Family villas", "Generational holdings"],
    credentials: ["RERA certified"],
    bio: "Khalid works the Al Raha and Khalifa City villa market that doesn't list. His database is twenty years of dinner-table relationships. If you're looking for a five-bed family villa nobody else has shown you, this is the call.",
    joined_at: "2018-09-20",
  },
  {
    email_local: "noor",
    slug: "noor-al-mansouri",
    display_name: "Noor Al-Mansouri",
    title: "Senior Advisor · Saadiyat villas",
    brn: "BRN-58418",
    languages: ["Arabic", "English", "French"],
    specialties: ["Villas", "Off-market", "Hidd & Lagoons"],
    credentials: ["RERA certified", "MRICS"],
    bio: "Specialises in the Saadiyat villa clusters that rarely list publicly — Hidd, Saadiyat Reserve, Lagoons. Noor's last three closes were all off-market introductions; none of them ever appeared on a portal.",
    joined_at: "2021-04-05",
  },
  {
    email_local: "james",
    slug: "james-whitaker",
    display_name: "James Whitaker",
    title: "Associate Advisor · Yas & Al Raha",
    brn: "BRN-58527",
    languages: ["English", "French"],
    specialties: ["Relocation", "Yas Acres", "British buyers"],
    credentials: ["RERA certified"],
    bio: "Joined Bazar from a London buyer-broker after his own relocation to Yas in 2022. James handles the British and European relocation briefs — knows which schools have actual waitlists vs theoretical ones.",
    joined_at: "2023-02-14",
  },
  {
    email_local: "karim",
    slug: "karim-boussaid",
    display_name: "Karim Boussaid",
    title: "Senior Advisor · Buyer briefs",
    brn: "BRN-58611",
    languages: ["French", "English", "Arabic"],
    specialties: ["Buyer representation", "Negotiation", "Fund-backed"],
    credentials: ["RERA certified", "CIPS"],
    bio: "Karim represents buyers only — never sellers, never developers, never dual-sided. His brief intake is forty-five minutes, in person, before he agrees to take the work. Most acquisitions close at 6–11% below the original ask.",
    joined_at: "2022-08-22",
  },

  // ─── Off-plan & Investment ───────────────────────────────────
  {
    email_local: "sarah",
    slug: "sarah-kazim",
    display_name: "Sarah Kazim",
    title: "Senior Advisor · Off-plan & Investment",
    brn: "BRN-58144",
    languages: ["English", "Arabic", "Urdu"],
    specialties: ["Off-plan", "Yield investment", "Foreign buyer"],
    credentials: ["RERA certified", "CFA Level II"],
    bio: "Sarah models the deal before she shows it. Her clients see a spreadsheet first, the property second. She closed the largest off-plan block transaction Bazar handled in 2025.",
    joined_at: "2020-11-03",
  },
  {
    email_local: "priya",
    slug: "priya-rajan",
    display_name: "Priya Rajan",
    title: "Senior Advisor · Investment desk",
    brn: "BRN-58504",
    languages: ["English", "Hindi", "Tamil"],
    specialties: ["Off-plan launches", "Yield analysis", "GCC investors"],
    credentials: ["RERA certified", "CFA Charterholder"],
    bio: "Priya runs Bazar's investment-thesis desk for clients deploying AED 5M+ across multiple units. She's known for being the advisor who tells you not to buy — when the numbers don't model, the recommendation is no.",
    joined_at: "2022-01-30",
  },
  {
    email_local: "adnan",
    slug: "adnan-qureshi",
    display_name: "Adnan Qureshi",
    title: "Senior Advisor · Commercial & investment",
    brn: "BRN-58702",
    languages: ["English", "Urdu", "Arabic"],
    specialties: ["Commercial", "ADGM", "Office leasing"],
    credentials: ["RERA certified", "MRICS"],
    bio: "Adnan covers the commercial side of the practice from ADGM and Al Maryah office leasing through to industrial yards in KIZAD and Mussafah. He'll tell you a tenant covenant story that the brochure doesn't.",
    joined_at: "2023-09-18",
  },

  // ─── Lettings ────────────────────────────────────────────────
  {
    email_local: "lina",
    slug: "lina-haddad",
    display_name: "Lina Haddad",
    title: "Senior Advisor · Tenant & rental",
    brn: "BRN-58177",
    languages: ["English", "Arabic", "Spanish"],
    specialties: ["Rent", "Relocation", "Diplomat & corporate"],
    credentials: ["RERA certified", "CIPS"],
    bio: "Lina runs the rent side of the practice. She's the advisor diplomats and senior expats keep on retainer — knows which buildings actually deliver on the brochure and which to avoid in August.",
    joined_at: "2021-07-08",
  },
  {
    email_local: "fatima",
    slug: "fatima-al-jaber",
    display_name: "Fatima Al-Jaber",
    title: "Associate Advisor · Lettings desk",
    brn: "BRN-58811",
    languages: ["Arabic", "English"],
    specialties: ["Lettings", "Landlord representation", "Renewal cycles"],
    credentials: ["RERA certified"],
    bio: "Fatima handles the landlord side of the lettings desk — asset management, renewal negotiations, and the annual cycle work that most agents won't touch. Owns the relationships, not just the transactions.",
    joined_at: "2023-11-04",
  },
];

/** Sanity check: 12 unique slugs. */
if (new Set(AGENTS.map((a) => a.slug)).size !== AGENTS.length) {
  throw new Error("Duplicate agent slug in AGENTS");
}
if (AGENTS.length !== 12) {
  throw new Error(`Expected 12 agents, got ${AGENTS.length}`);
}
