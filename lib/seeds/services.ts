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
    | "consulting"
    // Sprint 15 additions — closing the megamenu 404s.
    | "developer"
    | "rental-finance"
    | "sales-leasing"
    | "tenant-matchmaking";
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
  // ─────────────────────────────────────────────────────────────────────
  // Sprint 15 — four service desks the megamenu seed already links to.
  // Pricing + scope mirror the existing service voice; copy capped at one
  // screen each.
  // ─────────────────────────────────────────────────────────────────────
  {
    slug: "developer",
    name: "Developer services",
    one_liner:
      "Pre-launch advisory and exclusive client access for Abu Dhabi developers.",
    intro:
      "Most launches are noisy and indiscriminate. Bazar runs a parallel pre-launch channel: we curate a small group of qualified buyers, brief them on the project ahead of the public release, and feed back the price-sensitivity data that helps you tune the public launch. We don't list everything — only projects we'd defend with comparable evidence.",
    for_whom:
      "Master-plan developers and boutique sponsors launching AED 3M+ residential stock in Abu Dhabi who want a private soft-launch before broad marketing.",
    process_steps: [
      { title: "Project brief", body: "Two-hour workshop on the masterplan, payment structure, target segment, and competing launches. Output: a written GTM positioning memo." },
      { title: "Buyer curation", body: "We select 50-150 qualified Bazar clients matching the brief and run a private 14-day soft-launch window with full deal economics disclosed." },
      { title: "Launch data", body: "Weekly report on viewings, reservations, walked-away buyers, and price-sensitivity signals. Used to tune the public launch." },
      { title: "Public-launch handover", body: "We hand back to your in-house team or stay engaged as a syndication channel through handover." },
    ],
    pricing: "1.5% of soft-launch contracted GDV · or AED 250K retainer credited against the variable fee",
    contact_cta: "Talk to the developer desk",
    related_tool: null,
  },
  {
    slug: "rental-finance",
    name: "Rental finance management",
    one_liner:
      "Cash-flow modelling, mortgage optimisation, and currency management for non-resident landlords.",
    intro:
      "Owning rental property from abroad is mostly a financial exercise. Bazar's landlord-finance desk models your net cash flow against the underlying mortgage, optimises the refinancing window, and handles currency conversion in tranches — so you're not exposed to AED/GBP/USD swings on every rent cycle. Quarterly reports in your home currency.",
    for_whom:
      "Non-resident landlords with one or more mortgaged units in Abu Dhabi, particularly those receiving income in AED but reporting in another currency.",
    process_steps: [
      { title: "Portfolio review", body: "Underlying mortgage(s), rent roll, service charges, and tax-residence structure. We model net yield after every cost." },
      { title: "Refinance window", body: "Quarterly check against the open mortgage market. We flag refinance opportunities and run the application end-to-end if you want to switch." },
      { title: "Currency tranching", body: "Monthly rent split across staged FX conversions to dampen exchange-rate exposure. Settled to your home account." },
      { title: "Reporting", body: "One-page quarterly statement in your home currency. Annual pack for your tax adviser." },
    ],
    pricing: "AED 950 per unit per month · all-in · no FX spread on top of interbank · cancellable monthly",
    contact_cta: "Book a portfolio review",
    related_tool: { label: "Mortgage calculator", href: "/tools/mortgage" },
  },
  {
    slug: "sales-leasing",
    name: "Sales & leasing",
    one_liner:
      "Bulk-sale and bulk-lease representation for owners with multi-unit portfolios.",
    intro:
      "When a single owner controls 10+ units in one building, the normal sales playbook stops working — concentration risk depresses the unit price and exhausts the local buyer pool. Bazar's sales & leasing desk runs structured disposition programmes: phased releases, syndication to family offices, build-to-rent buyer matching, and bulk-lease deals with corporate tenants. Designed for owners who want certainty of execution over the last 5% of unit price.",
    for_whom:
      "Owners holding multi-unit portfolios (whole floors, whole buildings, master-developer recoveries), and family offices unwinding inherited stock.",
    process_steps: [
      { title: "Portfolio audit", body: "Unit-level valuation, comparable comps, tenancy rollover, and a 24-month disposition or build-to-rent letting plan." },
      { title: "Buyer / tenant book", body: "Private syndication round to the Bazar family-office network for sales. For lettings: corporate-relocation desks and serviced-apartment operators." },
      { title: "Execution", body: "Phased contracts to keep market price stable. Conveyancing handled in-house for sales; bulk-lease contracts negotiated centrally." },
      { title: "Reporting", body: "Monthly disposition report — units cleared, average unit price vs underwriting, time-on-market. Stay-or-pivot decision points flagged early." },
    ],
    pricing: "0.85% of sale value (sales) · 6% of first-year rent (lease) · paid on closing each tranche",
    contact_cta: "Discuss a portfolio mandate",
    related_tool: null,
  },
  {
    slug: "tenant-matchmaking",
    name: "Tenant matchmaking",
    one_liner:
      "Targeted tenant search for high-spec or unusual units — not a portal listing.",
    intro:
      "Some units don't let well on the portals — six-bedroom villas, ultra-prime serviced apartments, mixed-use ground floors, anything above AED 600K annual rent. The buyer pool is small enough that you don't want a public listing. Bazar's tenant-matchmaking desk works the other way around: we know the families and corporates moving in, and we find them the property — not the other way around.",
    for_whom:
      "Landlords of villas above AED 600K p.a., serviced-apartment owners, and owners of unusual stock (heritage buildings, mixed-use, oversized layouts) that doesn't fit the portal template.",
    process_steps: [
      { title: "Unit brief", body: "Property walk + a one-page brief that captures price, term, audience, and what would make this tenant the right one. No portal photos, no public listing." },
      { title: "Targeted outreach", body: "We approach 8-12 known families or corporate tenants who match the brief. All confidential — your address is never in a portal feed." },
      { title: "Viewings", body: "Two-three private viewings per week with pre-qualified tenants. We're onsite for each one." },
      { title: "Negotiation & contract", body: "We handle the tenancy contract, security deposit, post-dated cheques, and the Ejari registration once signed." },
    ],
    pricing: "Half-month rent · capped at AED 50K · paid on signed tenancy contract",
    contact_cta: "Brief the matchmaking desk",
    related_tool: null,
  },
];

export function getSeedServiceBySlug(slug: string): SeedService | null {
  return SEED_SERVICES.find((s) => s.slug === slug) ?? null;
}
