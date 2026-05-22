/**
 * Open-role placeholders for /careers. Sprint 1 ships the page; production
 * content comes from the team or the Pages CMS.
 */

export type SeedCareerRole = {
  id: string;
  title: string;
  location: string;
  type: "Full-time" | "Part-time" | "Contract";
  team: string;
  posted: string;
  intro: string;
  responsibilities: string[];
  requirements: string[];
  apply_email: string;
};

export const SEED_CAREERS: SeedCareerRole[] = [
  {
    id: "senior-advisor-saadiyat",
    title: "Senior Advisor · Saadiyat",
    location: "Abu Dhabi, UAE (on-site)",
    type: "Full-time",
    team: "Advisory",
    posted: "2026-05-08",
    intro:
      "We are hiring a thirteenth advisor — by exception, and only for someone who already runs a Saadiyat book. You will own the relationship, the brief, and the close. The firm gives you operations, conveyancing, marketing, and a brand. You give us discipline and discretion.",
    responsibilities: [
      "Carry a book of 30–60 active client relationships across Saadiyat and Hidd.",
      "Lead end-to-end from brief through DLD transfer; no handover at offer stage.",
      "Contribute to the Bazar Brief — at least one field note per quarter.",
      "Mentor one junior advisor.",
    ],
    requirements: [
      "Minimum 7 years on the buy/sell side in Abu Dhabi residential.",
      "Valid RERA broker certification + active BRN.",
      "Demonstrable AED 400M+ in closed transactions in the last 24 months.",
      "Native or fully fluent in Arabic AND English.",
    ],
    apply_email: "careers@bazar.ae",
  },
  {
    id: "lead-advisor-rent",
    title: "Lead Advisor · Rent & Tenant",
    location: "Abu Dhabi, UAE (on-site)",
    type: "Full-time",
    team: "Advisory",
    posted: "2026-05-01",
    intro:
      "Most firms treat rent as a junior beat. We don't. The tenant side is where Bazar's relationships start — and most of our buy-side mandates begin with a five-year tenant. We're hiring a senior to expand the rent practice from one advisor to two.",
    responsibilities: [
      "Inherit and grow Lina Haddad's rent book.",
      "Build the relocation desk for diplomats and senior expats.",
      "Coordinate with the property-management team on let-and-manage handovers.",
    ],
    requirements: [
      "5+ years tenant-side experience in Abu Dhabi.",
      "Active BRN.",
      "Demonstrable embassy/consulate or HR relocation relationships.",
    ],
    apply_email: "careers@bazar.ae",
  },
  {
    id: "operations-manager",
    title: "Operations Manager",
    location: "Abu Dhabi, UAE (on-site)",
    type: "Full-time",
    team: "Operations",
    posted: "2026-04-22",
    intro:
      "Bazar runs lean — 12 advisors, no junior brokers, one operations seat that owns conveyancing, KYC, audit, and the back-office process. We are hiring a deputy to take half of this off the founder's plate.",
    responsibilities: [
      "Own the DLD conveyancing pipeline — currently ~18 transactions per quarter.",
      "Run KYC and AML compliance across all active engagements.",
      "Audit advisor pipelines weekly; ensure SLA on lead response.",
      "Be the named compliance officer to RERA/ADREC.",
    ],
    requirements: [
      "5+ years in Abu Dhabi real-estate operations or DLD conveyancing.",
      "Strong English + Arabic; written and spoken.",
      "Comfortable with software — not a coder, but you will run our CRM and audit reports.",
    ],
    apply_email: "careers@bazar.ae",
  },
];
