/**
 * Ten editorial articles for /insights — added on top of the three that
 * already ship in supabase/seed.sql (saadiyat-q1-2026, off-plan-payment-
 * plans-decoded, freehold-zoning-q2-2026).
 *
 * Voice constraints (per Bazar brand):
 *   - numerically honest, slightly contrarian
 *   - no hype, no emoji, no exclamation marks
 *   - lead with the qualifying detail, not the conclusion
 *   - reference specific Abu Dhabi areas, towers, regulations
 *   - 600–1200 words; deeper than a portal blog, shorter than a report
 *
 * Author rotation matches each article to an advisor whose specialty
 * fits the topic. author_slug is resolved at seed time against the
 * seeded staff rows.
 */

export type ArticleSeed = {
  slug: string;
  title: string;
  excerpt: string;
  category:
    | "market_report"
    | "buyers_guide"
    | "sellers_guide"
    | "field_note"
    | "policy"
    | "off_plan_watch";
  author_slug: string;
  body_html: string;
  /** ISO-8601 date; published_at is set days-ago from this. */
  published_days_ago: number;
  read_minutes: number;
  seo: { meta_title: string; meta_description: string };
};

export const ARTICLES: ArticleSeed[] = [
  {
    slug: "yas-island-q1-2026",
    title: "Yas closed Q1 quietly: 41 transactions, a 4.2% lift, and a thinner middle",
    excerpt:
      "Yas Island's Q1 looked uneventful on the headline. The transaction profile underneath it didn't.",
    category: "market_report",
    author_slug: "mariam-al-hashimi",
    published_days_ago: 4,
    read_minutes: 9,
    body_html: `<p>The Yas Island resale tape for Q1 2026 closed at 41 transactions, with a weighted median of AED 1,720 per square foot. That's a 4.2% lift on the same quarter last year. On the headline, this is the dullest island story we've covered in eighteen months.</p><h2>Why the headline is misleading</h2><p>The 41 closes split unevenly by segment. Yas Acres villas (3–5 bed) accounted for 23 of them — over half the volume — and traded inside a tight AED 1,650–1,820/ft² band. The other 18 were apartments and townhouses in Yas Bay, Mayan, and West Yas, and the dispersion there is much wider.</p><p>The implication: <strong>the villa market is finding a floor</strong>; the apartment market is not yet repriced.</p><h2>What's actually moving</h2><p>Three sub-stories, in order of conviction:</p><ol><li><strong>Yas Acres units priced under AED 4.2M cleared in under 45 days on market.</strong> Above that band, time-on-market doubled. Family buyers are paying for the school proximity premium and not much else.</li><li><strong>Yas Bay studios saw the first negative quarter in two years.</strong> Three transactions closed 8–12% below the late-2025 comparable. The short-let yield narrative is wobbling now that Etihad Arena event-night premiums have normalised.</li><li><strong>West Yas inventory is unusually thin.</strong> Six closed transactions, five of them off-market introductions. We're aware of two more in negotiation that haven't hit the books yet.</li></ol><h2>What we'd watch for Q2</h2><p>If Yas Acres villa pricing breaks AED 1,800/ft² on a verifiable comparable, the buy-side conversation moves from "find me one" to "wait for the next handover wave." We don't think that happens before September.</p><blockquote>Quarterly transaction volume is a noisy signal. Median price within a tight band, sustained over two quarters, is not.</blockquote><p>The DLD comparables search and DARI permit registry are the canonical sources for any number in this piece. Where we cite an off-market close, it's a transaction we directly handled or saw the contract for.</p>`,
    seo: {
      meta_title: "Yas Island Q1 2026 — Bazar market report",
      meta_description:
        "41 transactions on Yas in Q1 2026. Villas finding a floor, apartments not yet repriced. Bazar's quarterly market report.",
    },
  },

  {
    slug: "al-reem-q1-2026",
    title: "Al Reem: the 2010s towers are repricing. Slowly, and not uniformly.",
    excerpt:
      "Twelve years after handover, the first wave of Reem high-rises is testing what a mid-market Abu Dhabi address is actually worth.",
    category: "market_report",
    author_slug: "omar-darwish",
    published_days_ago: 6,
    read_minutes: 11,
    body_html: `<p>Al Reem Island recorded 89 secondary-market transactions in Q1 2026, the highest quarterly volume in the island's history. The weighted median fell 2.1% year-on-year to AED 1,180/ft². Both numbers tell you something. Neither tells you the right thing on its own.</p><h2>The towers driving the volume</h2><p>Five buildings accounted for 54 of the 89 closes: Sky Tower, Sun Tower, Reflection, Sigma Towers, and Marina Heights. Four of those are 2014–2016 vintage. The fifth (Reflection) is 2021.</p><p>This is the cohort that's now seeing its <strong>first major owner-rotation cycle</strong> — original buyers are aging out, mortgage refinances are coming due, and the buildings themselves are entering their first round of major capex.</p><h2>Two things working against pricing</h2><ul><li><strong>Service charges are catching up with reality.</strong> Three of the five towers ran service-charge votes in late 2025 that lifted the per-ft² rate by 14–22%. Buyers are pricing this in.</li><li><strong>Newer comparable inventory is more compelling.</strong> Bayviews Saadiyat and Reem Hills Phase 4 are pulling intent at price points that, two years ago, would have closed in Reem.</li></ul><h2>One thing working for it</h2><p>The Reem yield story still holds — sustained tenant demand from ADGM and Maryah, school proximity, the new bridge timing — and gross rental yields on the 2016-vintage 1-beds are still printing 7.2–7.8%. That's a hard number to find in the rest of the freehold market.</p><h2>What this means for buyers</h2><p>If your brief is yield, the Reem 2010s tower segment is the most interesting it's been in three years. If your brief is capital growth, the conviction is much weaker — there's not yet a clear thesis for what gets repriced first.</p><p>We took two clients off Reem briefs in Q1 and redirected them to Bayviews. We took one client onto a Reem brief because the yield maths was unambiguous.</p>`,
    seo: {
      meta_title: "Al Reem Island Q1 2026 — Bazar market report",
      meta_description:
        "89 transactions on Al Reem in Q1 2026, the highest in island history. The 2010s towers are repricing — but not uniformly.",
    },
  },

  {
    slug: "off-plan-handover-schedule-2026",
    title: "The 2026 handover schedule: 14,400 units, four bottlenecks",
    excerpt:
      "Aldar alone is handing over 9,200 units in Abu Dhabi this year. Here's what to watch, and what could slip.",
    category: "off_plan_watch",
    author_slug: "sarah-kazim",
    published_days_ago: 8,
    read_minutes: 8,
    body_html: `<p>Across the published handover calendars from Aldar, Bloom, IMKAN, and the smaller developers, Abu Dhabi is scheduled to receive approximately 14,400 residential units in 2026. About 9,200 of those are Aldar. Of those Aldar 9,200, roughly 5,800 are on Saadiyat or Yas.</p><p>That's the number. Now the four bottlenecks.</p><h2>1. Saadiyat utility connections</h2><p>Three Saadiyat schemes are handing over within a 90-day window in Q3. The cooling and high-voltage tie-ins for two of them depend on the same substation upgrade. If that slips, expect a 60–90 day handover delay on at least one.</p><h2>2. Yas Acres landscaping and amenity</h2><p>The amenity phase for the latest Yas Acres release is contractually tied to the unit handover but practically lagging by 4–6 months in our last walk-throughs. Buyers should plan for handover with placeholder amenity, not the brochure version.</p><h2>3. Reem Hills Phase 4 fit-out spec</h2><p>The kitchen and joinery spec on Phase 4 was downgraded versus Phase 3 — same developer, same brand, materially different materials. Anyone buying Phase 4 on Phase 3 photo references should walk the show villa, not the early-release renderings.</p><h2>4. Mortgage pre-approval lead times</h2><p>Local lenders are quoting 6–8 weeks for HNW non-resident mortgage pre-approvals — twice last year's cadence. If your handover is Q4 and you need finance, the conversation with the lender starts now, not at handover.</p><h2>The non-obvious takeaway</h2><p>Handover volume is the easy story. The interesting story is the long tail of post-handover snagging cycles, service-charge first-resolutions, and amenity-promise delivery. We expect those to be the dominant 2026 advisory work — more than the new-launch noise.</p>`,
    seo: {
      meta_title: "Abu Dhabi 2026 handover schedule — Bazar off-plan watch",
      meta_description:
        "14,400 units scheduled for handover in Abu Dhabi this year. Four bottlenecks to watch and what could slip.",
    },
  },

  {
    slug: "noc-snagging-handover",
    title: "Handover day: the NOC, the snag list, and the things nobody mentions",
    excerpt:
      "A practical buyers' guide to the forty-eight hours around handover. Written for buyers who haven't done it before and don't want surprises.",
    category: "buyers_guide",
    author_slug: "karim-boussaid",
    published_days_ago: 12,
    read_minutes: 7,
    body_html: `<p>Handover in Abu Dhabi is procedurally straightforward and operationally messy. The procedure is documented; the operational reality is not. Here's what to actually do, in order.</p><h2>Before the handover appointment</h2><ul><li><strong>Get a third-party snagging report.</strong> AED 1,800–3,500 depending on unit size. Don't skip this. The developer's handover representative is incentivised to close the appointment in 90 minutes.</li><li><strong>Confirm the NOC sequence.</strong> Developer NOC → DLD title deed → utility connection NOCs (cooling, electricity, water). Each has a fee. Total cost typically AED 2,800–4,400. Confirm who pays — sometimes it's the developer.</li><li><strong>Walk the unit before signing the handover form.</strong> Once you sign, the snag list rolls into a separate workflow with longer SLAs.</li></ul><h2>On handover day</h2><p>The handover appointment is structured as: orientation, key handover, snag-list walkthrough, signature. The structure is fine. The pacing isn't.</p><p>The three things we see clients miss most often:</p><ol><li><strong>Air-conditioning under load.</strong> Empty unit + cool weather = AC looks fine. Run it on full cool for 30 minutes during the appointment.</li><li><strong>Joinery alignment.</strong> Wardrobe doors, kitchen drawers, and shower screens — open and close every one of them. Misalignment is the most common warranty claim and the slowest to fix post-handover.</li><li><strong>Service charge ledger.</strong> Ask for the unit-level service charge ledger from the management company. Confirm there are no accrued back-charges that transfer with the title.</li></ol><h2>The first 48 hours after handover</h2><p>Photograph everything. Note meter readings. Sign nothing additional. If the developer follows up with a "small administrative form" 24 hours later, it's not always small.</p>`,
    seo: {
      meta_title: "Handover day in Abu Dhabi — Bazar buyers' guide",
      meta_description:
        "What to do in the 48 hours around an Abu Dhabi handover: NOCs, snagging, joinery alignment, and the small administrative forms.",
    },
  },

  {
    slug: "service-charge-transparency-tufl",
    title: "How to read a service charge schedule (the TUFL) without falling asleep",
    excerpt:
      "Most buyers skim the service charge schedule. The people who don't, save 8–14% on five-year ownership cost.",
    category: "buyers_guide",
    author_slug: "priya-rajan",
    published_days_ago: 16,
    read_minutes: 9,
    body_html: `<p>Every Abu Dhabi freehold purchase comes with a service charge schedule — formally a Tenants/Users Fee List (TUFL) — published by the management company and approved by the regulator. Most buyers glance at the total and move on. That's a mistake.</p><h2>The structure</h2><p>A TUFL has three sections that matter:</p><ul><li><strong>Fixed allocations</strong> (the master community fee, the reserve fund contribution, the insurance line)</li><li><strong>Variable operational</strong> (cleaning, security, landscaping, MEP maintenance, lift maintenance)</li><li><strong>Special projects</strong> (capex, repainting cycles, façade work)</li></ul><p>The first section is roughly fixed across comparable buildings. The third is where developers and management companies hide cost.</p><h2>The questions to ask</h2><ol><li><strong>How old is the building, and where is the reserve fund at as a percentage of estimated capex over the next ten years?</strong> A 2014 tower with a 18% reserve ratio is going to surprise you.</li><li><strong>What was the year-on-year change in the variable operational line over the last three years?</strong> A 4–6% annual creep is normal. 12%+ is a warning.</li><li><strong>Are there any pending special-project assessments?</strong> A signed-off but not-yet-billed façade repaint can add AED 30–80K to the buyer's first-year cost.</li></ol><h2>What 'transparency' actually means</h2><p>By regulation, the management company must disclose. In practice, the disclosure quality varies enormously building-to-building. Three of the top ten Saadiyat addresses publish line-item TUFLs with footnotes. Four of them publish a one-page summary. The other three publish neither voluntarily — you have to ask.</p><p>If a building won't share a detailed TUFL during your offer process, the answer is not 'just buy and find out later.'</p>`,
    seo: {
      meta_title: "Service charge schedules in Abu Dhabi — buyers' guide",
      meta_description:
        "How to read an Abu Dhabi TUFL, what questions to ask the management company, and where developers hide cost in the schedule.",
    },
  },

  {
    slug: "pricing-a-saadiyat-villa",
    title: "How to actually price a Saadiyat villa for sale",
    excerpt:
      "The honest answer is that the comparables are thin and the listing price you choose moves the eventual close more than most sellers realise.",
    category: "sellers_guide",
    author_slug: "noor-al-mansouri",
    published_days_ago: 18,
    read_minutes: 8,
    body_html: `<p>If you own a Saadiyat villa and you're thinking about selling in 2026, you're working with a comparable set of fewer than fifty completed transactions in the last twenty-four months. That's not enough data to price by formula. Here's how we price one.</p><h2>The four anchors</h2><ol><li><strong>Cluster comparables (last 24 months).</strong> Same cluster, same villa type, same orientation. Adjust for view, plot size, and renovation level.</li><li><strong>Same-cluster off-market intelligence.</strong> What we know was offered and not accepted, or accepted and not yet closed. This is the data nobody publishes.</li><li><strong>Replacement-cost economics.</strong> If a comparable plot is available off-plan from the developer, the buyer has a credible alternative — and your ceiling.</li><li><strong>Demand pipeline.</strong> How many active buyer briefs we (or competing firms) currently hold for this cluster, at what budget band.</li></ol><h2>What pricing strategy does to outcome</h2><p>Saadiyat villas at the right price typically transact within 60 days. The same villa at +12% takes 6–9 months and usually closes at the same or lower number. The pricing tax is not theoretical.</p><blockquote>The seller who lists at the right number gets a competitive process. The seller who lists 12% over gets a forensic negotiation that often discovers issues the right price would never have surfaced.</blockquote><h2>The non-financial considerations</h2><p>If you're selling for relocation, your timeline is the constraint. If you're selling for upgrade, your timeline is the next plot. We'll price differently for each.</p>`,
    seo: {
      meta_title: "Pricing a Saadiyat villa for sale — Bazar sellers' guide",
      meta_description:
        "Saadiyat villa comparable sets are thin. Here's how we price one — and what the pricing tax actually costs in time-on-market.",
    },
  },

  {
    slug: "when-to-take-it-off-market",
    title: "When to take a listing off-market — and when not to",
    excerpt:
      "Off-market sounds discreet. It can also be the slower path to a worse outcome. Three rules of thumb.",
    category: "sellers_guide",
    author_slug: "khalid-al-zaabi",
    published_days_ago: 22,
    read_minutes: 6,
    body_html: `<p>About a third of what Bazar transacts never appears on Property Finder or Bayut. We're an off-market firm by positioning. We also frequently advise sellers <em>against</em> going off-market. Here's how we think about it.</p><h2>Off-market makes sense when:</h2><ul><li>The asset is unusual enough that the comparable buyer set is small and well-known to us.</li><li>Discretion is itself a transactional concern (separation, succession, public profile).</li><li>The seller can afford a longer process for a higher trust threshold.</li></ul><h2>Off-market doesn't make sense when:</h2><ul><li>The asset is mid-market — there are 40+ comparable buildings in the city and no information edge in keeping it quiet.</li><li>The seller is rate-pressured (refinance deadline, foreign tax window).</li><li>The seller's instinct for "discreet" is actually "I don't want to deal with photographers" — that's a different problem and we should solve it differently.</li></ul><h2>The mechanic that matters</h2><p>An off-market campaign generates competitive tension differently from a portal listing. You're getting tension from a curated buyer set with a shared social context, not from anonymous portal traffic. That works in the right asset class. It doesn't replace listing-led tension for a fungible apartment.</p><p>The honest test: if the asset wouldn't transact at the right price within 90 days on a portal listing, off-market won't fix that. Off-market is a positioning choice, not a pricing escape.</p>`,
    seo: {
      meta_title: "When to go off-market — Bazar sellers' guide",
      meta_description:
        "Off-market is positioning, not a pricing escape. Three rules of thumb for whether it's the right call for your sale.",
    },
  },

  {
    slug: "mamsha-lobby-walkthrough",
    title: "Field note: what the Mamsha lobby tells you about service",
    excerpt:
      "Twenty minutes in a lobby is a more honest signal of how a building runs than any brochure copy.",
    category: "field_note",
    author_slug: "mariam-al-hashimi",
    published_days_ago: 25,
    read_minutes: 5,
    body_html: `<p>I sat in the Mamsha Al Saadiyat residents' lobby for twenty minutes last Tuesday between two viewings. Here's what I noticed.</p><h2>The small things</h2><p>The concierge greeted three residents by name. The fourth — clearly visiting — got the badge-and-register routine without the resident-recognition softening. Both are correct; the calibration is what matters.</p><p>The desk had an open ledger for handover-day appointments — eleven handovers across two days in the next week. That's a meaningful pace and the lobby was unbothered by it.</p><h2>What it tells me as an advisor</h2><p>A residents' lobby is the leading indicator of how a building actually runs. Three signals worth reading:</p><ol><li><strong>How long does a delivery sit before someone moves it?</strong> Under 10 minutes is excellent. Over 30 is a slow building.</li><li><strong>Does the visitor process feel like a courtesy or a checkpoint?</strong> Same procedure, very different residents' experience over five years.</li><li><strong>Are residents using the lobby as an extension of their unit?</strong> If yes, the building has earned that trust.</li></ol><h2>Why I write this down</h2><p>The brochure tells you about the gym, the pool, the concierge. It does not tell you about delivery management, visitor calibration, or whether residents actually use the common spaces. Twenty minutes in a lobby is worth an hour of brochure-reading.</p><blockquote>The lobby is the building's interview. You should treat it as one.</blockquote>`,
    seo: {
      meta_title: "Field note: the Mamsha lobby — Bazar",
      meta_description:
        "Twenty minutes in the Mamsha Al Saadiyat residents' lobby. What it tells you about how a building actually runs.",
    },
  },

  {
    slug: "trakheesi-permit-q2-2026",
    title: "Trakheesi permit updates: small clauses, larger consequences",
    excerpt:
      "Two procedural clauses in the latest permit update will quietly change how broker-side dual representation is handled in Abu Dhabi.",
    category: "policy",
    author_slug: "adnan-qureshi",
    published_days_ago: 28,
    read_minutes: 7,
    body_html: `<p>The Q2 2026 Trakheesi permit registration update added two clauses that most market participants haven't yet absorbed. Both relate to dual representation. Both will quietly change the broker-side market.</p><h2>Clause 4.7 — Listing party identification</h2><p>The amended clause requires every listing permit to identify the <em>principal-side</em> brokerage at the moment of permit issuance — not just the listing brokerage. Where they are the same firm, this is a formality. Where they are different (dual representation, sub-agency), the disclosure is now visible on the permit itself.</p><p>The downstream effect: dual-representation arrangements that were previously opaque to the buyer side are now traceable. Buyers can — and increasingly will — verify the representation chain.</p><h2>Clause 5.3 — Commission disclosure on dual-side deals</h2><p>The companion clause requires written commission disclosure when a single firm or affiliated firms represent both buyer and seller. The language is permissive about the format, but explicit about the requirement.</p><p>This codifies what most fiduciary-aligned firms already do. The shift is for the firms that didn't.</p><h2>What this means in practice</h2><p>For buyers: ask explicitly whether the firm you're working with also represents the seller. If yes, ask for the disclosure in writing — that's now your right, not a courtesy.</p><p>For sellers: the registration field on your permit will now show information about the representation arrangement. Make sure you understand it before signing the listing agreement.</p><p>For the broker-side market: dual representation gets harder to monetise quietly. Not impossible — but harder.</p>`,
    seo: {
      meta_title: "Trakheesi Q2 2026 permit updates — Bazar policy briefing",
      meta_description:
        "Two clauses in the Q2 2026 Trakheesi update change how dual representation is handled in Abu Dhabi. Here's what to ask.",
    },
  },

  {
    slug: "saadiyat-q3-launches-preview",
    title: "Saadiyat Q3 launches: three to watch, one to wait on",
    excerpt:
      "Three new Saadiyat releases are landing between July and September. None of them are obvious buys at the announce price.",
    category: "off_plan_watch",
    author_slug: "sarah-kazim",
    published_days_ago: 32,
    read_minutes: 8,
    body_html: `<p>Three Saadiyat launches are scheduled to release between July and September 2026. We've reviewed the early-information packs for all three and we have advisor-network detail on a fourth that hasn't been confirmed.</p><h2>Release 1 — Mamsha Phase 4 (Aldar, late July)</h2><p>Two- and three-bed units, beachfront orientation, payment plan 30/70 with 18-month post-handover. Pricing guidance is AED 2,950–3,150/ft². At that band, this prices roughly 6–9% above the resale market on existing Mamsha phases — which means the off-plan premium is meaningful but not absurd.</p><p>Our read: a fine investment if you have a ten-year horizon. Not the best yield play. Worth the brochure call; not worth a same-week deposit.</p><h2>Release 2 — Saadiyat Reserve villas, Phase 2 (Aldar, August)</h2><p>4- and 5-bed villas, plot sizes 7,500–11,000 ft². Phase 1 sold out in a weekend and is now trading at +14–22% in the secondary market. Phase 2 is priced ~8% above Phase 1's launch number.</p><p>The price-discovery question: how much of the Phase 1 secondary premium is supply scarcity vs underlying demand? Our advisor-network detail suggests scarcity is doing more of the work than buyers admit. We'd be wary of paying full ask.</p><h2>Release 3 — Hidd Beachfront (Aldar, September)</h2><p>The Hidd cluster's first beachfront release. Three- and four-bed units. Pricing not yet disclosed but expected to be premium to Mamsha. If pricing comes in below AED 3,400/ft² we're interested. Above that, the Hidd thesis has to compete with new Saadiyat Lagoons inventory.</p><h2>One to wait on — Bulgari Phase 2</h2><p>Whispered for Q4 2026 but not officially confirmed. Phase 1 pricing was aspirational and the resale tape on it is thin enough to be unreliable. We're advising clients to let Phase 1 transact more meaningfully before evaluating Phase 2.</p>`,
    seo: {
      meta_title: "Saadiyat Q3 2026 launches — Bazar off-plan watch",
      meta_description:
        "Three Saadiyat releases between July and September 2026. Our read on pricing, payment plans, and which to wait on.",
    },
  },
];

if (new Set(ARTICLES.map((a) => a.slug)).size !== ARTICLES.length) {
  throw new Error("Duplicate article slug in ARTICLES");
}
