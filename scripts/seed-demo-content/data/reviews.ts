/**
 * Approved reviews for /agents/[slug] profiles. 2–3 per advisor.
 *
 * Voice: testimonials in the same editorial register as the rest of the
 * site — specific, not hyperbolic, willing to mention the small thing
 * that went wrong as well as what went right.
 */

export type ReviewSeed = {
  agent_slug: string;
  rating: 4 | 5;
  title: string;
  body: string;
  author_name: string;
  /** Days ago for created_at; spread across ~18 months. */
  created_days_ago: number;
};

export const REVIEWS: ReviewSeed[] = [
  // Rashid Bin Faris — leadership / family office
  {
    agent_slug: "rashid-bin-faris",
    rating: 5,
    title: "Family-office mandate, handled end-to-end",
    body: "Rashid took a complex three-property mandate for our family office and ran it through to closing in under five months. The discretion was the differentiator — at no point did we hear any of this back from the wider market.",
    author_name: "Adel Al-Suwaidi",
    created_days_ago: 60,
  },
  {
    agent_slug: "rashid-bin-faris",
    rating: 5,
    title: "Strategic, not transactional",
    body: "We engaged Bazar specifically because Rashid pushed back on our initial brief. The conversation that followed reshaped our portfolio in a way none of the other firms were willing to challenge.",
    author_name: "Helena Carter",
    created_days_ago: 220,
  },

  // Mariam Al-Hashimi — Saadiyat & Yas
  {
    agent_slug: "mariam-al-hashimi",
    rating: 5,
    title: "Knows the Mamsha cohort cold",
    body: "Mariam had walked all four buildings we were considering. Her notes on each — including the things the brochures don't mention, like the way the morning light hits the bedrooms — saved us from a decision we'd have regretted.",
    author_name: "Daniel Hartley",
    created_days_ago: 40,
  },
  {
    agent_slug: "mariam-al-hashimi",
    rating: 5,
    title: "Quietly competent",
    body: "Closing took longer than expected because the seller's NOC was held up at the developer. Mariam managed the timeline without drama. Found out afterwards she'd called the developer's compliance team directly to unblock it.",
    author_name: "Faisal Bin Hussain",
    created_days_ago: 95,
  },
  {
    agent_slug: "mariam-al-hashimi",
    rating: 5,
    title: "Off-market introduction, no waste",
    body: "We described the brief once. She came back with two options, one of which was off-market. The match was good enough that we closed within seven weeks of the first viewing.",
    author_name: "Sarah Lockhart",
    created_days_ago: 280,
  },

  // Omar Darwish — Reem & Maryah
  {
    agent_slug: "omar-darwish",
    rating: 4,
    title: "Honest about a building we shouldn't have bought",
    body: "We came in wanting a Reflection apartment we'd already half-fallen in love with. Omar walked us through the comparable rentals and the service-charge trajectory and convinced us to look at Sigma Towers instead. He was right.",
    author_name: "Tom Bradshaw",
    created_days_ago: 70,
  },
  {
    agent_slug: "omar-darwish",
    rating: 5,
    title: "Tower-level knowledge",
    body: "Omar has lived in three Reem buildings and walked us through the practical differences — chiller-free vs cooling, lift waits, delivery management. Brochures don't tell you any of that.",
    author_name: "Mira Hosseini",
    created_days_ago: 175,
  },

  // Khalid Al-Zaabi — Heritage estates
  {
    agent_slug: "khalid-al-zaabi",
    rating: 5,
    title: "The villa we couldn't have found anywhere else",
    body: "We had been searching for a five-bedroom Al Raha villa for nine months. Khalid introduced us to one that wasn't listed and hadn't been considered for sale until that conversation. Closed at 8% under expected market.",
    author_name: "Ahmed Al-Mansoori",
    created_days_ago: 130,
  },
  {
    agent_slug: "khalid-al-zaabi",
    rating: 5,
    title: "Patient, generational view",
    body: "Khalid took two years to find the right plot for us — he turned away three deals that were 'fine but not right'. We trusted him to keep looking, and he did.",
    author_name: "Saif bin Faraj",
    created_days_ago: 310,
  },

  // Noor Al-Mansouri — Saadiyat villas
  {
    agent_slug: "noor-al-mansouri",
    rating: 5,
    title: "Hidd cluster, off-market",
    body: "Noor introduced us to a Hidd villa that was a private listing through a colleague's network. The negotiation was direct and quiet. Closed at the price we expected — no surprises.",
    author_name: "Elena Volkov",
    created_days_ago: 50,
  },
  {
    agent_slug: "noor-al-mansouri",
    rating: 5,
    title: "Detailed walk-through with a contractor",
    body: "Noor arranged for us to walk the villa with her preferred contractor on the second visit. The contractor noted three structural items the snagging report hadn't picked up. Saved us a meaningful sum on handover negotiations.",
    author_name: "Marco Bianchi",
    created_days_ago: 145,
  },

  // James Whitaker — Yas & Al Raha
  {
    agent_slug: "james-whitaker",
    rating: 5,
    title: "Made the relocation actually work",
    body: "We moved from London to Yas Acres in 2024. James got us through the British school waitlist, three viewings around schedule constraints, and a handover that completed before our shipping container arrived. He had done it himself the year before.",
    author_name: "Andrew Pemberton",
    created_days_ago: 80,
  },
  {
    agent_slug: "james-whitaker",
    rating: 4,
    title: "Strong on the practical side",
    body: "James is better than any other agent we've worked with on the boring operational stuff — utility transfer, internet, school registration support. The villa search itself was straightforward; the post-purchase coordination was where he stood out.",
    author_name: "Claire Mitchell",
    created_days_ago: 195,
  },

  // Karim Boussaid — Buyer briefs
  {
    agent_slug: "karim-boussaid",
    rating: 5,
    title: "Buyer-side only, and it shows",
    body: "Karim's intake process was a 45-minute call before he agreed to take our brief. The brief he came back with reshaped the search. The eventual purchase was a building we'd never have looked at otherwise.",
    author_name: "Olivier Mercier",
    created_days_ago: 65,
  },
  {
    agent_slug: "karim-boussaid",
    rating: 5,
    title: "Negotiated 11% below the original ask",
    body: "Karim spent the second half of the negotiation in conversations with the seller's lawyer about title deed peculiarities we hadn't noticed. The final price came in 11% below the original ask. No theatre, just careful work.",
    author_name: "Hannah Kirby",
    created_days_ago: 180,
  },

  // Sarah Kazim — Off-plan & Investment
  {
    agent_slug: "sarah-kazim",
    rating: 5,
    title: "Talked us out of the wrong off-plan",
    body: "We had a deposit ready for a unit at one of the new Yas launches. Sarah modelled the yield with our actual financing assumptions and showed us why the second-best option on Saadiyat would close 4% net higher over five years. We changed direction.",
    author_name: "Reem Al-Khoury",
    created_days_ago: 55,
  },
  {
    agent_slug: "sarah-kazim",
    rating: 5,
    title: "Block transaction, no surprises",
    body: "Sarah ran a six-unit block acquisition for our fund. Every milestone was documented in advance, every comparable was sourced from DLD rather than the developer's own talking points. Cleanest transaction we've done in three years.",
    author_name: "Jin-soo Park",
    created_days_ago: 200,
  },

  // Priya Rajan — Investment desk
  {
    agent_slug: "priya-rajan",
    rating: 5,
    title: "Told us not to buy",
    body: "Priya spent two hours modelling our brief with us and concluded that the deal didn't make sense at our financing cost. She got paid nothing for that work. We came back six months later when the assumptions changed.",
    author_name: "Vikram Iyer",
    created_days_ago: 90,
  },
  {
    agent_slug: "priya-rajan",
    rating: 5,
    title: "Investment thesis we could defend",
    body: "Priya didn't just find us the property — she wrote the investment thesis we needed for our family-office governance committee. It was the cleanest document any advisor has produced for us across three markets.",
    author_name: "Lakshmi Ramachandran",
    created_days_ago: 240,
  },

  // Adnan Qureshi — Commercial
  {
    agent_slug: "adnan-qureshi",
    rating: 4,
    title: "ADGM office floor, fitted",
    body: "Adnan handled our 18,000 ft² ADGM office requirement. Knew the buildings, knew which floors had what fit-out spec from the previous tenants. The lease negotiation went a round or two longer than expected but the final terms were solid.",
    author_name: "Daniel Eberhardt",
    created_days_ago: 110,
  },
  {
    agent_slug: "adnan-qureshi",
    rating: 5,
    title: "KIZAD logistics — knew the operators",
    body: "We needed a 40,000 ft² warehouse with specific clear-height and dock-loading requirements. Adnan walked us through three options, two of which weren't listed, and gave us a clear read on the operator quality of each landlord. Real coverage of an under-covered segment.",
    author_name: "Hassan Al-Maktoum",
    created_days_ago: 255,
  },

  // Lina Haddad — Tenant & rental
  {
    agent_slug: "lina-haddad",
    rating: 5,
    title: "Diplomatic relocation, full service",
    body: "Lina handled our diplomatic relocation — 12 viewings shortlisted to 3, one signed within a month, full coordination with our embassy's residency office. Knew which buildings would be amenable to the diplomatic clauses.",
    author_name: "Charlotte Larsen",
    created_days_ago: 35,
  },
  {
    agent_slug: "lina-haddad",
    rating: 5,
    title: "Knows the buildings, not just the listings",
    body: "Lina told us not to rent in two buildings that had open inventory at our price point. She'd seen what their summer cooling performance was actually like. Six months in, we're grateful — we hear from neighbours in those buildings what we'd have been dealing with.",
    author_name: "Pavel Antonov",
    created_days_ago: 160,
  },
  {
    agent_slug: "lina-haddad",
    rating: 4,
    title: "Renewal negotiation, fair outcome",
    body: "We came to Lina at renewal time after our previous broker tried to push us into a 9% increase. She took it to 3.5% with the same landlord. Took longer than we hoped but the outcome was right.",
    author_name: "Yara Karim",
    created_days_ago: 290,
  },

  // Fatima Al-Jaber — Lettings desk (landlord side)
  {
    agent_slug: "fatima-al-jaber",
    rating: 5,
    title: "Landlord-side asset management done right",
    body: "Fatima handles the renewal cycles and asset management on our four-unit Reem portfolio. The reports are quarterly, specific, and the renewal decisions are presented with comparable evidence. Saved us from a bad re-letting decision in Q3 2025.",
    author_name: "Imran Sayyed",
    created_days_ago: 75,
  },
  {
    agent_slug: "fatima-al-jaber",
    rating: 5,
    title: "Specific tenant covenant assessment",
    body: "Fatima sat through three tenant interviews with us on a higher-value letting. Her read on the eventual chosen tenant included two specific risks we hadn't considered. Both were managed pre-emptively in the lease drafting.",
    author_name: "Mohammed Al-Yassin",
    created_days_ago: 205,
  },
];

if (REVIEWS.length < 24) {
  throw new Error(`Expected at least 24 reviews (2 per agent), got ${REVIEWS.length}`);
}
