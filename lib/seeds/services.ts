/**
 * Service hub + 5 sub-page content. Sprint 1 ships these as inline content;
 * Sprint 3 / 7g introduces a CMS-managed Pages model where editors can
 * override these via `/admin/pages/services-*`.
 */

export type SeedService = {
  slug:
    | "sell"
    | "buy"
    | "manage"
    | "conveyancing"
    | "invest"
    // T2-F additions — slugs aligned with the megamenu (0031_megamenu.sql).
    | "snagging"
    | "handover"
    | "interior-design"
    | "residency-visas"
    | "consulting";
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
  // ─────────────────────────────────────────────────────────────────────
  // T2-F additions — five service pages aligned with the megamenu seed.
  // Slugs match `0031_megamenu.sql` so the published nav has no dead
  // links.  Copy is voice-led, capped at one screen of content each.
  // ─────────────────────────────────────────────────────────────────────
  {
    slug: "snagging",
    name: "Snagging inspection",
    one_liner:
      "Independent pre-handover and DLW inspection so your developer doesn't hand over a defect list.",
    intro:
      "Every off-plan handover should be inspected by someone who isn't on the developer's payroll. Bazar's snagging team walks the unit with a structured 200-point checklist — finishes, MEP, fit-out tolerances, smart-home commissioning — and files a defect schedule the developer is contractually obligated to remediate before you sign off.",
    for_whom:
      "Off-plan buyers approaching handover. Effective regardless of who you bought through.",
    process_steps: [
      { title: "Schedule the inspection", body: "Book once your developer issues the handover notice. We attend within 5 working days." },
      { title: "Two-hour onsite walk", body: "Senior inspector + junior, documenting every defect with photos and GPS-stamped notes. You're welcome to attend." },
      { title: "Defect schedule", body: "Within 24 hours you receive a PDF report with every defect, severity, and the contractual remedy. Filed directly with the developer." },
      { title: "Re-inspection", body: "We return after remediation to verify each defect is closed before you sign the handover certificate." },
    ],
    pricing: "AED 1,500 per studio/1-bed · AED 2,500 per 2-3 bed · AED 4,500+ per villa · re-inspection included",
    contact_cta: "Book a snagging inspection",
    related_tool: null,
  },
  {
    slug: "handover",
    name: "Handover support",
    one_liner:
      "End-to-end handover concierge — DLD title transfer, utility activation, keys in your hand.",
    intro:
      "The two weeks between handover notice and move-in are administrative chaos: DLD title transfer, escrow release, Etisalat / DEWA / TAQA / ADDC activation, community access cards, parking allocation. Bazar's handover desk runs the whole sequence on your behalf so the only thing you do is collect the keys.",
    for_whom:
      "Off-plan buyers handing over remotely or domestically — particularly non-residents who can't be onsite for two consecutive weeks.",
    process_steps: [
      { title: "Pre-handover audit", body: "Verify outstanding balance, escrow status, developer NOC, snagging closure. We surface blockers before they delay the transfer." },
      { title: "DLD transfer", body: "Book the trustee slot, attend with the developer, deliver the title deed in your name or your nominee's." },
      { title: "Utility + community", body: "Open Etisalat / DEWA / TAQA / ADDC accounts, register on the community portal, collect access cards and parking remotes." },
      { title: "Key handover", body: "Final walkthrough with the developer, keys handed over, fob count verified, photographic record filed." },
    ],
    pricing: "AED 6,500 flat · payable on title-transfer day · all DLD fees on the purchaser",
    contact_cta: "Engage the handover desk",
    related_tool: null,
  },
  {
    slug: "interior-design",
    name: "Interior design & furnishing",
    one_liner:
      "Boutique interior design and turn-key furnishing — restrained briefs, no portfolio look-alikes.",
    intro:
      "We work with three Abu Dhabi-based interior studios on a referred-basis. The brief is always restrained: no developer-fitout uplifts, no Instagram show-home replication. The result should look like the home of someone who lives there, not someone who furnished it last week. Pricing structured per-room with a hard cap.",
    for_whom:
      "Owners taking handover of a shell-and-core or fully-fitted unit who want a coherent, lived-in finish without managing three trades themselves.",
    process_steps: [
      { title: "Brief & moodboard", body: "Two sessions onsite to capture intent, a written brief, and a moodboard with material samples. Sign-off before any procurement." },
      { title: "Procurement & build", body: "Studio sources, procures, and project-manages. You receive a weekly photo update. Variations approved against the signed brief, not after the fact." },
      { title: "Install", body: "Three-day install window. Snagging walk on day 2. Handover on day 3, photographic record filed." },
      { title: "Aftercare", body: "30-day defect period at the studio's cost. Optional ongoing relationship for additional rooms or annual refresh." },
    ],
    pricing: "Per-room fixed-fee · typically AED 35K–90K per room depending on scope · procurement billed at studio cost + 12%",
    contact_cta: "Discuss a design brief",
    related_tool: null,
  },
  {
    slug: "residency-visas",
    name: "Residency visa support",
    one_liner:
      "Property-linked Golden Visa and 2-year residency processing, end-to-end.",
    intro:
      "Buying property in the UAE doesn't automatically grant residency — but the right purchase makes you eligible. Bazar's visa desk handles the application: eligibility check, documentation, medical, Emirates ID, and dependants. We work to a fixed fee with a published timeline.",
    for_whom:
      "Non-resident purchasers eyeing the 10-year Golden Visa (AED 2M+ property) or the 2-year property-linked residency (AED 750K+).",
    process_steps: [
      { title: "Eligibility check", body: "30-minute consultation to confirm property qualifies, family structure, prior UAE visas, fingerprint clearance." },
      { title: "Documentation", body: "We compile title deed, valuation, mortgage NOC, passport, medical, photos, and dependants paperwork — and check every requirement against the latest ICP rules." },
      { title: "Submission & medical", body: "File via ICP, book the medical slot, and chase the case officer if anything stalls. Typical end-to-end window: 4-6 weeks." },
      { title: "Emirates ID & residency", body: "Collect Emirates ID, stamp the visa, register dependants. The whole family is residence-ready in one sweep." },
    ],
    pricing: "AED 9,500 principal applicant + AED 4,500 per dependant · government fees pass-through",
    contact_cta: "Book a visa consultation",
    related_tool: null,
  },
  {
    slug: "consulting",
    name: "Consulting",
    one_liner:
      "Senior-advisor consulting hours for owners, family offices, and developers — no buy/sell engagement required.",
    intro:
      "Sometimes the question isn't 'should I buy or sell' — it's 'what does this neighbourhood do over five years', or 'is my portfolio structured for handover risk', or 'how should I think about this off-plan launch'. Bazar's consulting block lets you book a senior advisor by the hour, with no commitment to a transaction.",
    for_whom:
      "Owners and family offices with portfolio-level decisions, developers stress-testing positioning, and institutional buyers evaluating Abu Dhabi for the first time.",
    process_steps: [
      { title: "Brief", body: "A short written brief — what you're solving for, what you've already considered, what good looks like." },
      { title: "Session", body: "60-90 minute call or in-person session with the assigned senior advisor. Outputs documented." },
      { title: "Follow-up", body: "A one-page memo within 48 hours capturing recommendations, risks, and next steps. Yours to act on as you see fit." },
    ],
    pricing: "AED 950 per hour · billed in 30-minute increments · 4-hour blocks discounted to AED 3,500",
    contact_cta: "Book consulting hours",
    related_tool: null,
  },
];

export function getSeedServiceBySlug(slug: string): SeedService | null {
  return SEED_SERVICES.find((s) => s.slug === slug) ?? null;
}
