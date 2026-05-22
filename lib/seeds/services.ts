/**
 * Service hub + 5 sub-page content. Sprint 1 ships these as inline content;
 * Sprint 3 / 7g introduces a CMS-managed Pages model where editors can
 * override these via `/admin/pages/services-*`.
 */

export type SeedService = {
  slug: "sell" | "buy" | "manage" | "conveyancing" | "invest";
  name: string;
  one_liner: string;
  intro: string;
  for_whom: string;
  process_steps: { title: string; body: string }[];
  pricing: string;
  contact_cta: string;
  related_tool: { label: string; href: string } | null;
};

export const SEED_SERVICES: SeedService[] = [
  {
    slug: "sell",
    name: "Sell with Bazar",
    one_liner: "Quiet, advisor-led sale process for vendors who don't want their property on Property Finder.",
    intro:
      "A Bazar listing is shown to a curated buyer pool first. We don't publish on the public portals unless the off-market route doesn't clear in the agreed window. The 1.5% advisory fee is the only cost — no listing fee, no marketing surcharge.",
    for_whom:
      "Owners selling AED 3M+ residences who would rather have one negotiation than ten viewings.",
    process_steps: [
      { title: "Valuation", body: "We model the property against DMT and DARI comparables and propose a private price." },
      { title: "Off-market window", body: "60-day silent listing to our buyer book and the wider Bazar advisor network." },
      { title: "Public listing (only if needed)", body: "If the off-market window closes without an offer, we move to Property Finder + Bayut with photography, virtual tour, and a public price." },
      { title: "Offer & close", body: "One advisor leads the negotiation. KYC and conveyancing handled in-house. DLD transfer scheduled with the buyer." },
    ],
    pricing: "1.5% of sale price · paid on transfer · no upfront fees",
    contact_cta: "Book a valuation",
    related_tool: { label: "Free valuation", href: "/tools/valuation" },
  },
  {
    slug: "buy",
    name: "Buy with Bazar",
    one_liner: "Advisor-led buyer representation — we work for you, not the listing.",
    intro:
      "Most Abu Dhabi brokers are paid by the seller. Bazar is fiduciary-aligned: when you engage us as a buyer, we represent you exclusively for the duration of the search. We surface off-market stock, model the deal, and negotiate.",
    for_whom: "Buyers spending AED 2M+ who want a single advisor, not a portal full of brokers.",
    process_steps: [
      { title: "Brief", body: "A 45-minute session to capture intent, budget, timeline, and constraints. Output: a written brief you sign off on." },
      { title: "Shortlist", body: "Off-market + public stock filtered against the brief. Typically 4–8 properties per round; you see the rationale, not the noise." },
      { title: "Viewings", body: "We attend with you. After each viewing, a one-page debrief — what's right, what's wrong, what comes next." },
      { title: "Offer & close", body: "We negotiate price, snags, and terms. KYC + DLD handled in-house. Mortgage broker referral if needed." },
    ],
    pricing: "1% of purchase price · paid on transfer · or AED 25,000 retainer credited against final fee",
    contact_cta: "Engage an advisor",
    related_tool: { label: "Mortgage calculator", href: "/tools/mortgage" },
  },
  {
    slug: "manage",
    name: "Property management",
    one_liner: "Full-service letting + asset management for non-resident landlords.",
    intro:
      "We manage residential and small-portfolio commercial assets for owners who don't live in Abu Dhabi. One point of contact, monthly statements, end-to-end tenant relations, snags, and renewals.",
    for_whom: "Non-resident landlords with one or more units in Abu Dhabi.",
    process_steps: [
      { title: "Onboarding", body: "Property condition report, photography, tenancy contract template, DLD/RERA registration." },
      { title: "Listing & let", body: "Marketing across portals + our tenant book. Tenant screening, contract negotiation, deposit handling." },
      { title: "Ongoing management", body: "Rent collection, repair coordination, annual inspection, utility transfer, ADJD compliance." },
      { title: "Renewal & exit", body: "90-day renewal cycle, market re-pricing, move-out inspection, deposit reconciliation." },
    ],
    pricing: "8% of annual rent · minimum AED 10,000 · 2-year initial term",
    contact_cta: "Get a management quote",
    related_tool: null,
  },
  {
    slug: "conveyancing",
    name: "Conveyancing",
    one_liner: "Standalone conveyancing for transactions you bring to us.",
    intro:
      "If you've negotiated a deal without an advisor, Bazar's conveyancing desk handles the DLD-side process: title search, NOC, mortgage discharge, transfer, and trustee booking. Flat fee per transaction.",
    for_whom: "Buyers and sellers who've already agreed terms and need DLD process support.",
    process_steps: [
      { title: "Title & permit check", body: "Verify ORN, Trakheesi/DARI permit, title deed, mortgage status, service-charge clearance." },
      { title: "MoU & deposit", body: "Drafting + escrow management of the 10% MoU deposit at the DLD-approved trustee." },
      { title: "NOC & clearance", body: "Coordinate developer NOC, master-community clearance, utility transfer." },
      { title: "Transfer", body: "Book trustee appointment, attend with parties, file with DLD, deliver title deed." },
    ],
    pricing: "AED 18,000 flat · payable at MoU signing · all DLD fees on the parties",
    contact_cta: "Engage conveyancing",
    related_tool: null,
  },
  {
    slug: "invest",
    name: "Investment advisory",
    one_liner: "Yield-modelled investment selection — we close on numbers, not stories.",
    intro:
      "For investors evaluating Abu Dhabi residential for yield. We model gross + net yield, vacancy, service charge, and 10-year DLD area trend against your target IRR. If the model doesn't clear, we don't show the property.",
    for_whom: "Buy-to-let investors targeting AED 2M+ units or block-buy opportunities.",
    process_steps: [
      { title: "Investment thesis", body: "Capture your target IRR, hold period, leverage, and risk tolerance. Output: a one-page thesis." },
      { title: "Pipeline", body: "We surface 3–6 opportunities per month with the underlying spreadsheet. Areas, off-plan handovers, and secondary stock." },
      { title: "Due diligence", body: "Service-charge history, tenancy rollover, mortgageability, foreign-buyer eligibility, exit liquidity." },
      { title: "Acquire & let", body: "Negotiate, close, and either let directly or hand to the management desk." },
    ],
    pricing: "1% of acquisition · or 12% of net rent for the first 24 months on let-and-manage",
    contact_cta: "Discuss a mandate",
    related_tool: { label: "Compare opportunities", href: "/tools/compare" },
  },
];

export function getSeedServiceBySlug(slug: string): SeedService | null {
  return SEED_SERVICES.find((s) => s.slug === slug) ?? null;
}
