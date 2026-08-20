import { emptyImage } from "./types";
import type { ImageValue, MasterPageDef, SectionValues } from "./types";

/**
 * Section definitions for the four marketing master pages.
 *
 * Every `defaults` value is the copy that was hardcoded in the page before it
 * became editable, so an un-edited page renders byte-identically to before.
 * Keep them in sync: if you change a headline in a component, change it here —
 * the component's own literal is only a fallback for callers that pass nothing.
 */

import {
  text,
  area,
  link,
  image,
  video,
  toggle,
  eyebrow,
  heading,
  body,
  ctaPair,
  faqList,
  tileList,
  chipList,
  statList,
  propTypeList,
} from "./fields";
import { DEVELOPERS_PAGE } from "./sections/developers";
import { LEGAL_TERMS_PAGE, LEGAL_COOKIES_PAGE } from "./sections/legal";
import { SERVICES_PAGE } from "./sections/services";
import { INSIGHTS_PAGE } from "./sections/insights";
import { ABOUT_PAGE } from "./sections/about";
import { PARTNER_BAND_DEFAULTS } from "./sections/partner-band";
import { CONTACT_PAGE } from "./sections/contact";
import { SELL_PAGE } from "./sections/sell";
import { PROPERTY_MANAGEMENT_PAGE } from "./sections/property-management";
import { PROPERTY_CONSULTATION_PAGE } from "./sections/property-consultation";
import { QR_PAGE } from "./sections/qr";
import { CONTACT_QR_PAGE } from "./sections/contact-qr";
import { MORTGAGE_PAGE } from "./sections/mortgage";


// ── shared default content ──────────────────────────────────────────────
// Mirrors AD_COMMUNITIES / SALE_PROP_TYPES in
// app/[locale]/(public)/_components/marketing/ad-data.ts — the copy the pages render
// today. Change both together.
const AD_COMMUNITY_CHIPS = [
  "Al Reem Island",
  "Yas Island",
  "Saadiyat Island",
  "Al Raha Beach",
  "Al Maryah Island",
  "Khalifa City",
  "Hudayriyat Island",
  "Masdar City",
].map((label) => ({ label, href: null }));

const SALE_PROP_TYPE_COPY: [string, string][] = [
  [
    "Apartments",
    "Find modern apartments in prime Abu Dhabi communities, ideal for individuals, couples, families, and professionals.",
  ],
  [
    "Villas",
    "Explore spacious villas designed for family living, privacy, outdoor space, and long-term comfort.",
  ],
  [
    "Townhouses",
    "Discover townhouses that offer the perfect balance between space, community living, and everyday convenience.",
  ],
  [
    "Penthouses",
    "Browse premium penthouses with larger layouts, high-end finishes, and exceptional views.",
  ],
  [
    "Commercial Properties",
    "Find offices, retail spaces, and other commercial opportunities for your business.",
  ],
];

// ────────────────────────────────────────────────────────────────────────
// Home
// ────────────────────────────────────────────────────────────────────────
/**
 * The home page's opening five questions, verbatim from the client audit.
 *
 * Exported so the seed migration that writes them into the live document can
 * import the same array — two copies of five answers is two chances for the
 * page and the CMS to disagree about what the site says.
 */
export const HOME_FAQ_ITEMS = [
  {
    q: "What is the benefit of buying off-plan?",
    a: "Off-plan properties often offer flexible payment plans, lower entry prices, and potential capital growth before handover.",
  },
  {
    q: "What should I check before buying a property?",
    a: "Check the location, developer, price, payment plan, ownership type, service charges, and expected rental demand.",
  },
  {
    q: "What is mortgage pre-approval?",
    a: "Mortgage pre-approval shows how much a bank may be willing to lend before you choose a property.",
  },
  {
    q: "What is a payment plan?",
    a: "A payment plan is the schedule of instalments paid to the developer or seller over a set period.",
  },
  {
    q: "What are service charges?",
    a: "Service charges are fees paid for building or community maintenance, facilities, and shared areas.",
  },
];

const HOME: MasterPageDef = {
  key: "home",
  label: "Home",
  path: "/",
  description: "The front page — hero, browsing entries, and trust sections.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Full-bleed video hero with the search bar.",
      locked: true,
      dataNote:
        "Which hero variant renders is set in Settings → Brand. These fields apply to the default full-bleed hero.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        body({ key: "subtitle", label: "Sub-headline" }),
        video(
          "video",
          "Background video",
          "MP4 or WebM, up to 25 MB. Aim for 10 seconds or less, 1080p, no audio — it loops silently behind the headline. Leave unset to keep the built-in clip.",
        ),
        image(
          "poster",
          "Poster image",
          "Painted immediately, before the video loads, and shown instead of it on reduced-motion. Use a frame from the video.",
        ),
        text("link_1_label", "First link label", { max: 60, optional: true }),
        link("link_1_href", "First link"),
        text("link_2_label", "Second link label", { max: 60, optional: true }),
        link("link_2_href", "Second link"),
      ],
      defaults: {
        eyebrow: "Bazar · Abu Dhabi",
        video: { media_id: null, alt: null, label: null },
        poster: { media_id: null, alt: null, label: null },
        title: "Find a home worth keeping.",
        subtitle:
          "Curated marketplace and bespoke advisory for buyers, sellers, and investors across the United Arab Emirates.",
        link_1_label: "Browse Properties",
        link_1_href: "/off-plan",
        link_2_label: "Talk to an Advisor",
        link_2_href: "/concierge",
      },
    },
    {
      key: "area_map",
      label: "Area map",
      description: "Interactive map of Abu Dhabi communities.",
      dataNote:
        "Pins come from published areas and listings — only the copy above the map is editable here.",
      fields: [
        eyebrow(),
        heading(),
        body({ max: 400 }),
      ],
      defaults: {
        eyebrow: "Where to live",
        heading: "Find your area first. The home follows.",
        body: null,
      },
    },
    {
      key: "location_browsing",
      label: "Location-based browsing",
      description: "Overview tile plus a grid of community cards.",
      dataNote:
        "Listing counts on each card always come from live data. Leave the card list empty to show the top 8 published areas automatically.",
      fields: [
        eyebrow(),
        heading(),
        body(),
        ...ctaPair("CTA label"),
        text("overview_name", "Overview tile · title", { max: 80 }),
        link("overview_href", "Overview tile · link"),
        image("overview_image", "Overview tile · image"),
        {
          key: "cards",
          label: "Community cards",
          kind: "list",
          itemLabel: "card",
          max: 12,
          seedKey: "areas",
          help: "Switch cards off to hide them without deleting them.",
          fields: [
            toggle("enabled", "Show this card"),
            text("name", "Title", { max: 80 }),
            link("href", "Link"),
            image("image", "Image"),
            text("slug", "Area slug", {
              max: 140,
              optional: true,
              // A lookup key, not a label. Folded into Arabic the area
              // resolves to nothing and the card silently disappears — a
              // failure an Arabic proofreader cannot see, because the Arabic
              // reads fine and what broke was the lookup.
              i18n: false,
              help: "Matches the live listing count to this card.",
            }),
          ],
        },
      ],
      defaults: {
        eyebrow: "Location-based browsing",
        heading: "Your next location starts here",
        body: "Discover leading communities across Abu Dhabi.",
        cta_label: "All locations",
        cta_href: "/areas",
        overview_name: "Abu Dhabi",
        overview_href: "/areas",
        overview_image: { media_id: null, alt: null, label: "abu dhabi" },
        cards: [],
      },
    },
    {
      key: "off_plan_projects",
      label: "Off-plan projects",
      description: "Carousel of featured developments.",
      dataNote:
        "Each card is a development project page — its name, price, area and cover image come from that record. Leave the list empty to show the three most recent published projects.",
      fields: [
        eyebrow(),
        heading(),
        body(),
        ...ctaPair(),
        {
          key: "projects",
          label: "Featured projects",
          kind: "list",
          itemLabel: "project",
          max: 6,
          seedKey: "developments",
          help: "Pick the projects to feature, in the order they should appear.",
          fields: [
            toggle("enabled", "Show this project"),
            {
              key: "slug",
              label: "Project",
              kind: "select",
              optionsKey: "developments",
              placeholder: "Choose a development",
            },
          ],
        },
      ],
      defaults: {
        eyebrow: "Off-plan projects for sale",
        heading: "New developments in Abu Dhabi",
        body: "Explore the latest off-plan projects across top communities.",
        cta_label: "All developments",
        cta_href: "/developments",
        projects: [],
      },
    },
    {
      key: "featured_properties",
      label: "Featured properties",
      description: "Carousel of featured listings.",
      dataNote:
        "Each card is a live listing — its price, beds, area and photo come from that record. Leave the list empty to show the most recent published listings for sale.",
      fields: [
        eyebrow(),
        heading(),
        body(),
        ...ctaPair(),
        {
          key: "listings",
          label: "Featured listings",
          kind: "list",
          itemLabel: "listing",
          max: 12,
          seedKey: "properties",
          help: "Pick the listings to feature, in the order they should appear.",
          fields: [
            toggle("enabled", "Show this listing"),
            {
              key: "slug",
              label: "Listing",
              kind: "select",
              optionsKey: "properties",
              placeholder: "Choose a property",
            },
          ],
        },
      ],
      defaults: {
        eyebrow: "Featured properties for sale",
        heading: "Featured properties, handpicked for you",
        body: "Discover properties that bring you closer to the lifestyle you are looking for.",
        cta_label: "All properties",
        cta_href: "/buy/search",
        listings: [],
      },
    },
    {
      key: "list_your_property",
      label: "List your property",
      description: "Seller lead-capture band with a form.",
      fields: [eyebrow(), heading(), body(), image("image", "Photo")],
      defaults: {
        eyebrow: "List your property",
        heading: "List your property",
        body: "Looking to sell or rent? We'll handle the process for you.",
        image: { media_id: null, alt: null, label: "Abu Dhabi skyline" },
      },
    },
    {
      key: "mortgage_calculator",
      label: "Mortgage calculator",
      description: "Dark band with the inline repayment calculator.",
      fields: [eyebrow(), heading()],
      defaults: {
        eyebrow: "Mortgage calculator",
        heading: "Estimate your monthly payments before making your move",
      },
    },
    {
      key: "who_we_are",
      label: "Who we are",
      description: "About the firm, with headline stats.",
      fields: [
        eyebrow(),
        heading(),
        body({ max: 900 }),
        image("photo", "Photo", "Landscape works best — shown at 8:5."),
        statList(4),
      ],
      defaults: {
        eyebrow: "Who we are",
        heading: "About Bazar Real Estate",
        photo: {
          media_id: null,
          alt: null,
          label: "bazar abu dhabi office",
        },
        body: "Established in 2005, Bazar Real Estate L.L.C. is a leading award-winning real estate agency in the UAE, recognized for its market expertise, professional excellence, and trusted presence in the region's ever-evolving property market.",
        stats: [
          { value: "20+", label: "Years in market" },
          { value: "ADREC & DLD", label: "Regulated" },
          { value: "Al Bateen", label: "Head office" },
        ],
      },
    },
    /*
     * Both bands used to declare `fields: []` — presentational, nothing to
     * edit. That was true of the LOGOS, which come from the catalogue, and
     * wrong about the words around them: the eyebrow, headline, standfirst
     * and button label were literals in the components, so /ar rendered four
     * English strings in the middle of an Arabic page with no CMS field to
     * put the Arabic in. The defaults below are those literals verbatim.
     */
    {
      key: "developers",
      label: "Developer partners",
      description: "Marquee of developer logos, and the words around it.",
      dataNote: "The logos themselves come from the developers catalogue.",
      fields: [eyebrow(), heading(), body({ max: 400 }), text("cta_label", "Button label", { max: 60, optional: true })],
      defaults: {
        eyebrow: "Our Developers",
        heading: "The developers shaping the UAE.",
        body: "Direct relationships with the region's leading developers give our clients early access to landmark communities, new launches, and off-plan releases.",
        cta_label: "All developers",
      },
    },
    {
      key: "partners",
      label: "Partner ecosystem",
      description: "Shared partner band (also used on /about).",
      dataNote:
        "The logos come from the partner list in code. Editing the copy here changes the home page only — /about carries its own copy for the same band.",
      fields: [eyebrow(), heading(), body({ max: 400 }), text("cta_label", "Button label", { max: 60, optional: true })],
      defaults: PARTNER_BAND_DEFAULTS,
    },
    {
      key: "faqs",
      label: "FAQs",
      description: "Accordion of common questions.",
      fields: [eyebrow(), heading(), body(), faqList()],
      defaults: {
        eyebrow: "FAQs",
        heading: "Frequently asked questions",
        body: "Clear guidance for every step of your real estate journey.",
        /*
         * The five questions used to live in `home-faqs.tsx` as a hardcoded
         * array the component fell back to whenever this list was empty —
         * which it always was, because the section shipped with `items: []`.
         * So the CMS showed an editor no questions while the page rendered
         * five, and on /ar those five were English with nowhere to put the
         * Arabic. They are the section's default now, and the component
         * renders what it is given.
         */
        items: HOME_FAQ_ITEMS,
      },
    },
    {
      key: "testimonials",
      label: "Testimonials",
      description: "Client reviews.",
      // It used to say "the reviews table", which was never true — the quotes
      // were a hardcoded seed. They are now a library section, edited once and
      // read by this page and by any landing page that places the block.
      dataNote:
        "The reviews themselves are edited in Pages → Sub-pages → Sections → Testimonials, because the home page is not their only reader. The eyebrow and heading below belong to this page.",
      fields: [eyebrow(), heading()],
      defaults: {
        eyebrow: "Testimonials",
        heading: "Reviews and comments",
      },
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────
// Buy / Rent — both render through BuyRentLanding, so they share a shape.
// ────────────────────────────────────────────────────────────────────────
type Vals = SectionValues;

function buyRentSections(opts: {
  hero: Vals;
  form: Vals;
  featured: Vals;
  map: Vals;
  lead: Vals;
  ways: Vals;
  propTypes: Vals;
  communities: Vals;
  why: Vals;
  faq: Vals;
  heroChips: { label: string; href: string | null }[];
  heroStats: { value: string; label: string }[];
  categoryTiles: Record<string, string | null | ImageValue>[];
  propTypeItems: Record<string, string | null | ImageValue>[];
  faqItems: { q: string; a: string }[];
}): MasterPageDef["sections"] {
  return [
    {
      key: "hero",
      label: "Hero",
      description: "Headline, quick-filter chips and the enquiry form.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        body({ key: "sub", label: "Sub-headline" }),
        image(
          "image",
          "Background image",
          "Fills the whole hero behind the headline and form, with a dark scrim over it so the text stays legible. Landscape, at least 2000px wide. Leave unset to keep the plain background.",
        ),
        chipList("chips", "Quick-filter chips", 8),
        statList(3),
      ],
      defaults: {
        ...opts.hero,
        // Unset by default: the hero keeps its current plain treatment until
        // someone picks a photo, so neither landing changes on deploy.
        image: emptyImage(null),
        chips: opts.heroChips,
        stats: opts.heroStats,
      },
    },
    {
      key: "hero_form",
      label: "Hero enquiry form",
      description: "Copy above the form in the hero card.",
      locked: true,
      fields: [
        text("form_title", "Form title", { max: 80 }),
        area("form_sub", "Form sub-copy", { max: 300 }),
      ],
      defaults: opts.form,
    },
    {
      key: "featured",
      label: "Featured listings",
      description: "Listing cards with a browse-all link.",
      dataNote: "Cards come from published listings.",
      fields: [
        heading({ key: "featured_title", label: "Heading" }),
        text("featured_cta", "Link label", { max: 60, optional: true }),
        link("featured_cta_href", "Link"),
      ],
      defaults: opts.featured,
    },
    {
      key: "map",
      label: "Map",
      description: "Interactive map of listings by community.",
      dataNote:
        "Pins come from published areas and listings — only the copy above the map is editable here.",
      fields: [
        eyebrow(),
        heading(),
        body({ max: 400 }),
      ],
      defaults: opts.map,
    },
    {
      key: "lead_band",
      label: "Lead band",
      description: "Second enquiry form further down the page.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        body({ key: "sub", label: "Sub-headline" }),
        image("image", "Photo"),
      ],
      defaults: opts.lead,
    },
    {
      key: "ways",
      label: "Ways to buy / rent",
      description: "Four image tiles linking into search.",
      fields: [
        eyebrow({ key: "ways_eyebrow", label: "Eyebrow" }),
        heading({ key: "ways_title", label: "Heading" }),
        tileList("tiles", "Tiles"),
      ],
      defaults: { ...opts.ways, tiles: opts.categoryTiles },
    },
    {
      key: "prop_types",
      label: "Property types",
      description: "Grid of property-type cards.",
      fields: [
        heading({ key: "prop_types_title", label: "Heading" }),
        // Off-plan has offered per-card images since it shipped; buy and rent
        // were left on placeholder art only, so the same grid looked unfinished
        // on the two highest-traffic landings. PropTypeGrid already renders
        // `imgUrl` and falls back to the placeholder caption, so this is opting
        // the section in rather than building anything new.
        propTypeList(8, { withImage: true }),
      ],
      defaults: { ...opts.propTypes, items: opts.propTypeItems },
    },
    {
      key: "communities",
      label: "Communities",
      description: "Chip cloud of areas.",
      fields: [
        eyebrow({ key: "communities_eyebrow", label: "Eyebrow" }),
        heading({ key: "communities_title", label: "Heading" }),
        body({ key: "communities_sub", label: "Sub-copy" }),
        chipList("chips", "Communities"),
        text("communities_cta", "Link label", { max: 60, optional: true }),
        link("communities_cta_href", "Link"),
      ],
      defaults: { ...opts.communities, chips: AD_COMMUNITY_CHIPS },
    },
    {
      key: "why",
      label: "Why Bazar",
      description: "Trust band with two stats.",
      fields: [
        heading({ key: "why_title", label: "Heading" }),
        area("why_body", "Body", { max: 900, optional: false }),
        statList(4),
      ],
      defaults: opts.why,
    },
    {
      key: "faq",
      label: "FAQs",
      description: "Accordion of common questions.",
      fields: [
        eyebrow({ key: "faq_eyebrow", label: "Eyebrow" }),
        heading({ key: "faq_title", label: "Heading" }),
        faqList(),
      ],
      defaults: { ...opts.faq, items: opts.faqItems },
    },
  ];
}

const BUY_TYPE_HREF: Record<string, string> = {
  Apartments: "/buy/search?type=apartment",
  Villas: "/buy/search?type=villa",
  Townhouses: "/buy/search?type=townhouse",
  Penthouses: "/buy/search?type=penthouse",
  "Commercial Properties": "/commercial",
};

const RENT_TYPE_HREF: Record<string, string> = {
  Apartments: "/rent/search?type=apartment",
  Villas: "/rent/search?type=villa",
  Townhouses: "/rent/search?type=townhouse",
  Penthouses: "/rent/search?type=penthouse",
  "Commercial Properties": "/commercial",
};

/**
 * `image` starts unset and `img` carries the placeholder caption, so an
 * un-edited page renders exactly the striped placeholder art it did before —
 * PropTypeGrid falls back to `img` (and then to the name) whenever no asset
 * is picked. Uploading a photo in the editor is what swaps it.
 */
const propTypeImageDefaults = (name: string) => ({
  image: emptyImage(name.toLowerCase()),
  img: name.toLowerCase(),
});

const BUY_PROP_TYPE_ITEMS = SALE_PROP_TYPE_COPY.map(([name, desc]) => ({
  name,
  desc,
  cta:
    name === "Commercial Properties"
      ? "Browse commercial"
      : `Browse ${name.toLowerCase()}`,
  href: BUY_TYPE_HREF[name] ?? "/buy/search",
  ...propTypeImageDefaults(name),
}));

const RENT_PROP_TYPE_ITEMS = SALE_PROP_TYPE_COPY.map(([name, desc]) => ({
  name,
  desc,
  cta: "View rentals",
  href: RENT_TYPE_HREF[name] ?? "/rent/search",
  ...propTypeImageDefaults(name),
}));

/**
 * Commercial has its own type vocabulary — the residential list (apartments,
 * villas, townhouses, penthouses) says nothing to someone looking for a floor
 * of offices. These map onto the commercial members of `PROPERTY_TYPES`.
 */
const COMMERCIAL_PROP_TYPE_COPY: [string, string, string][] = [
  [
    "Offices",
    "Fitted and shell-and-core office floors across Abu Dhabi's business districts, from single suites to whole-floor requirements.",
    "office",
  ],
  [
    "Retail",
    "Street-front units, mall space and F&B pitches in the catchments where footfall actually is.",
    "retail",
  ],
  [
    "Showrooms",
    "High-visibility showroom and light-industrial space with the access and ceiling heights those uses need.",
    "commercial",
  ],
  [
    "Whole buildings",
    "Full-building acquisitions and leasebacks for occupiers and investors buying income rather than a unit.",
    "building",
  ],
  [
    "Land",
    "Plots with the zoning and permitted use confirmed before you commit to a design.",
    "land",
  ],
];

const COMMERCIAL_PROP_TYPE_ITEMS = COMMERCIAL_PROP_TYPE_COPY.map(
  ([name, desc, type]) => ({
    name,
    desc,
    cta: `Browse ${name.toLowerCase()}`,
    href: `/commercial/search?type=${type}`,
    ...propTypeImageDefaults(name),
  }),
);

const BUY: MasterPageDef = {
  key: "buy",
  label: "Buy",
  path: "/buy",
  description: "The buy landing page. Search itself lives at /buy/search.",
  sections: buyRentSections({
    hero: {
      eyebrow: "Buy a Property",
      title: "Find the right property\nwith",
      title_emphasis: "confidence.",
      sub: "Browse ready, resale and off-plan homes across Abu Dhabi's most sought-after communities — with a senior advisor guiding every step.",
    },
    heroChips: [
      { label: "Apartment", href: "/buy/search?type=apartment" },
      { label: "Villa", href: "/buy/search?type=villa" },
      { label: "Penthouse", href: "/buy/search?type=penthouse" },
      { label: "Commercial", href: "/commercial" },
    ],
    heroStats: [],
    form: {
      form_title: "Start your property search",
      form_sub:
        "Tell us what you're looking for, and our team will help you find the right opportunity.",
    },
    featured: {
      featured_title: "Featured properties for sale",
      featured_cta: "Browse all for sale",
      featured_cta_href: "/buy/search",
    },
    map: {
      eyebrow: "On the map",
      heading: "Buy across Abu Dhabi's communities.",
      body:
        "Zoom into an area and tap a property to open its details — or pick a community below to focus the map.",
    },
    lead: {
      eyebrow: "Talk to an advisor",
      title: "Tell us what you're after.",
      sub: "Share your brief — area, budget, timeline — and a senior advisor will come back with a shortlist worth your time.",
      image: {
        media_id: null,
        alt: null,
        label: "Abu Dhabi waterfront · homes for sale",
      },
    },
    ways: {
      ways_eyebrow: "Ways to buy",
      ways_title: "What type of property are you looking for?",
    },
    categoryTiles: [
      {
        name: "Off-Plan Properties",
        desc: "New launches with structured payment plans.",
        cta: "Browse off-plan",
        href: "/off-plan",
        img: "off-plan tower · render",
        image: { media_id: null, alt: null, label: null },
      },
      {
        name: "Resale Properties",
        desc: "Established homes ready for handover.",
        cta: "Browse resale",
        href: "/buy/search",
        img: "resale apartment",
        image: { media_id: null, alt: null, label: null },
      },
      {
        name: "Ready-to-Move Properties",
        desc: "Vacant, keys-in-hand homes.",
        cta: "Browse ready",
        href: "/buy/search",
        img: "ready villa · interior",
        image: { media_id: null, alt: null, label: null },
      },
      {
        name: "Commercial Properties",
        desc: "Offices, retail and land.",
        cta: "Browse commercial",
        href: "/commercial",
        img: "commercial tower",
        image: { media_id: null, alt: null, label: null },
      },
    ],
    propTypes: { prop_types_title: "A home for every stage." },
    propTypeItems: BUY_PROP_TYPE_ITEMS,
    communities: {
      communities_eyebrow: "Where to buy",
      communities_title: "Abu Dhabi's leading communities.",
      communities_sub:
        "Explore properties across Abu Dhabi's most popular residential and lifestyle destinations.",
      communities_cta: "Explore all locations",
      communities_cta_href: "/areas",
    },
    why: {
      why_title: "Two decades of Abu Dhabi expertise, on your side.",
      why_body:
        "With over 20 years of UAE real estate experience, Bazar Real Estate combines local market knowledge, developer relationships, and client-focused guidance to help you make confident property decisions — whether you're buying your first home or your fifth investment.",
      stats: [
        { value: "20+ yrs", label: "In the UAE market" },
        { value: "Ready + off-plan", label: "Full-market access" },
      ],
    },
    faq: {
      faq_eyebrow: "Buying with Bazar",
      faq_title: "Questions, answered.",
    },
    faqItems: [
      {
        q: "Can Bazar help me buy both ready and off-plan properties?",
        a: "Yes. We assist with ready, resale, and off-plan property purchases across Abu Dhabi and the wider UAE.",
      },
      {
        q: "Can I buy property in Abu Dhabi as a foreigner?",
        a: "Foreign buyers can purchase property in designated investment areas in Abu Dhabi.",
      },
      {
        q: "Do I need mortgage approval before searching?",
        a: "It is recommended if you plan to finance your purchase, as it helps define your budget clearly.",
      },
      {
        q: "Can Bazar help with investment properties?",
        a: "Yes. We can guide you based on location, rental demand, developer reputation, and long-term value.",
      },
    ],
  }),
};

const RENT: MasterPageDef = {
  key: "rent",
  label: "Rent",
  path: "/rent",
  description: "The rent landing page. Search itself lives at /rent/search.",
  sections: buyRentSections({
    hero: {
      eyebrow: "Rent a Property",
      title: "Find your next\nrental in",
      title_emphasis: "Abu Dhabi.",
      sub: "Residential and commercial rentals across the city's most connected communities — matched to your budget, lifestyle and move-in date.",
    },
    heroChips: [
      { label: "Apartments", href: "/rent/search?type=apartment" },
      { label: "Villas", href: "/rent/search?type=villa" },
      { label: "Townhouses", href: "/rent/search?type=townhouse" },
      { label: "Offices", href: "/commercial" },
      { label: "Retail", href: "/commercial" },
    ],
    heroStats: [
      { value: "Residential", label: "& commercial" },
      { value: "8", label: "popular rental areas" },
      { value: "Vacant", label: "ready-to-move options" },
    ],
    form: {
      form_title: "Rent a Property",
      form_sub: "Find Your Next Rental Property in Abu Dhabi",
    },
    featured: {
      featured_title: "Featured properties for rent",
      featured_cta: "Browse all for rent",
      featured_cta_href: "/rent/search",
    },
    map: {
      // /rent renders AreaMapHome rather than the buy map, so its copy differs.
      eyebrow: "Rental areas",
      heading: "Rent by area. Start with the map.",
      body: null,
    },
    lead: {
      eyebrow: "Get matched",
      title: "Tell us what you're looking to rent.",
      sub: "Share your budget, preferred areas and move-in date — an advisor will send you matched rentals, usually within one business day.",
      image: {
        media_id: null,
        alt: null,
        label: "Abu Dhabi rental interiors",
      },
    },
    ways: { ways_eyebrow: "", ways_title: "" },
    categoryTiles: [],
    propTypes: { prop_types_title: "Rentals for every kind of tenant." },
    propTypeItems: RENT_PROP_TYPE_ITEMS,
    communities: {
      communities_eyebrow: "Popular rental areas",
      communities_title: "Rent in Abu Dhabi's leading communities.",
      communities_sub:
        "Explore rental properties across Abu Dhabi's most popular residential and lifestyle destinations.",
      communities_cta: "Explore rental locations",
      communities_cta_href: "/areas",
    },
    why: {
      why_title: "Local knowledge that turns a search into the right home.",
      why_body:
        "With deep local market knowledge and experience across residential and commercial properties, Bazar Real Estate helps tenants find the right rental option with clarity and confidence — from shortlist to move-in.",
      stats: [
        { value: "Homes + offices", label: "Residential & commercial" },
        { value: "Budget-led", label: "Location recommendations" },
      ],
    },
    faq: {
      faq_eyebrow: "Renting with Bazar",
      faq_title: "Questions, answered.",
    },
    faqItems: [
      {
        q: "Can Bazar help me find both residential and commercial rentals?",
        a: "Yes. We assist with homes, apartments, villas, offices, retail spaces, and other commercial rentals.",
      },
      {
        q: "What documents do tenants usually need?",
        a: "Tenants usually need identification documents, contact details, and payment information.",
      },
      {
        q: "Can I rent a ready-to-move property?",
        a: "Yes. We can help you find vacant and ready-to-move rental options.",
      },
      {
        q: "Can Bazar help with location recommendations?",
        a: "Yes. We can suggest areas based on your budget, lifestyle, commute, and property needs.",
      },
    ],
  }),
};

// ────────────────────────────────────────────────────────────────────────
// Commercial
// ────────────────────────────────────────────────────────────────────────
/**
 * `/commercial` used to be landing and search in one file, which is why it was
 * the last marketing route that could never be cached — it read `searchParams`
 * on every request. Registering it here gives it the same editable landing the
 * other three have, with search relocated to `/commercial/search`.
 */
const COMMERCIAL: MasterPageDef = {
  key: "commercial",
  label: "Commercial",
  path: "/commercial",
  description:
    "The commercial landing page. Search itself lives at /commercial/search.",
  sections: buyRentSections({
    hero: {
      eyebrow: "Commercial Property",
      title: "Office, retail and\nindustrial space,",
      title_emphasis: "advised properly.",
      sub: "Leases and freeholds across Abu Dhabi's business districts — sized to how your business actually works, with an advisor who reads the lease before you sign it.",
    },
    heroChips: [
      { label: "Offices", href: "/commercial/search?type=office" },
      { label: "Retail", href: "/commercial/search?type=retail" },
      { label: "Showrooms", href: "/commercial/search?type=commercial" },
      { label: "Whole buildings", href: "/commercial/search?type=building" },
      { label: "Land", href: "/commercial/search?type=land" },
    ],
    heroStats: [
      { value: "Lease", label: "& freehold" },
      { value: "Fit-out", label: "guidance included" },
      { value: "Abu Dhabi", label: "business districts" },
    ],
    form: {
      form_title: "Find commercial space",
      form_sub:
        "Tell us the use, the headcount and the timing — we'll come back with options that fit, not a list to wade through.",
    },
    featured: {
      featured_title: "Available commercial space",
      featured_cta: "Browse all commercial",
      featured_cta_href: "/commercial/search",
    },
    map: {
      eyebrow: "Business districts",
      heading: "Where Abu Dhabi does business.",
      body: null,
    },
    lead: {
      eyebrow: "Get matched",
      title: "Tell us what your business needs.",
      sub: "Share the use, approximate area and move-in date — an advisor will send you matched commercial options, usually within one business day.",
      image: {
        media_id: null,
        alt: null,
        label: "Abu Dhabi commercial districts",
      },
    },
    ways: { ways_eyebrow: "", ways_title: "" },
    categoryTiles: [],
    propTypes: { prop_types_title: "Space for every kind of operation." },
    propTypeItems: COMMERCIAL_PROP_TYPE_ITEMS,
    communities: {
      communities_eyebrow: "Commercial districts",
      communities_title: "Abu Dhabi's established business addresses.",
      communities_sub:
        "From the financial free-zone on Al Maryah to the mixed-use towers on Al Reem, the right address depends on who needs to reach you.",
      communities_cta: "Explore locations",
      communities_cta_href: "/areas",
    },
    why: {
      why_title: "A commercial search is a business decision, not a listing search.",
      why_body:
        "Fit-out liability, service charge, permitted use and the escalation clause matter more than the headline rent. Bazar advises on the whole cost of occupying a space, so the lease you sign is the one you thought you were signing.",
      stats: [
        { value: "Whole-cost", label: "Not headline rent" },
        { value: "Lease review", label: "Before you commit" },
      ],
    },
    faq: {
      faq_eyebrow: "Commercial with Bazar",
      faq_title: "Questions, answered.",
    },
    faqItems: [
      {
        q: "Do you handle both leasing and sales?",
        a: "Yes. We advise on commercial leases and on freehold acquisitions, including whole buildings and land with confirmed permitted use.",
      },
      {
        q: "Can you help with fit-out?",
        a: "We advise on what the fit-out will realistically cost and who carries it under the lease, and can introduce contractors we have worked with.",
      },
      {
        q: "What is the difference between shell-and-core and fitted space?",
        a: "Shell-and-core is delivered as a bare structure with services brought to the floor; fitted space is ready to occupy. The rent difference rarely reflects the true cost difference, which is what we help you work out.",
      },
      {
        q: "Which areas should I be looking at?",
        a: "It depends on who has to reach you — clients, staff or freight. Tell us the use and we will shortlist the districts that fit rather than the ones with the most availability.",
      },
    ],
  }),
};

// ────────────────────────────────────────────────────────────────────────
// Off-plan / New projects
// ────────────────────────────────────────────────────────────────────────
const OFF_PLAN: MasterPageDef = {
  key: "off-plan",
  label: "New projects",
  path: "/off-plan",
  description: "The off-plan landing page for new developments.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Headline and intro for new launches.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        body({ key: "sub", label: "Sub-headline" }),
        image("image", "Photo"),
        statList(3),
      ],
      defaults: {
        eyebrow: "New Projects",
        title: "New developments\nin Abu Dhabi.",
        sub: "Explore the latest off-plan projects across Abu Dhabi's top communities — from waterfront apartments to branded residences.",
        image: {
          media_id: null,
          alt: null,
          label: "off-plan skyline · architectural render",
        },
        stats: [
          { value: "78%", label: "of H1 2026 sales were off-plan" },
          { value: "8", label: "leading communities" },
          { value: "40/60", label: "flexible payment plans" },
        ],
      },
    },
    {
      key: "prop_types",
      label: "Property types",
      description: "Grid of off-plan property formats.",
      fields: [
        eyebrow(),
        heading(),
        body(),
        propTypeList(8, { withImage: true }),
      ],
      defaults: {
        eyebrow: "Property types",
        heading: "Off-plan, every format.",
        body: null,
        items: [
          {
            name: "Apartments",
            desc: "Discover modern off-plan apartments in Abu Dhabi's most connected communities.",
            cta: "View off-plan apartments",
            href: "/off-plan/search?type=apartment",
          },
          {
            name: "Villas",
            desc: "Explore spacious villas designed for privacy, comfort, and long-term family living.",
            cta: "View off-plan villas",
            href: "/off-plan/search?type=villa",
          },
          {
            name: "Townhouses",
            desc: "Find contemporary townhouses built around community living and everyday convenience.",
            cta: "View off-plan townhouses",
            href: "/off-plan/search?type=townhouse",
          },
          {
            name: "Penthouses",
            desc: "Discover exclusive penthouses with premium views, spacious layouts, and elevated living.",
            cta: "View off-plan penthouses",
            href: "/off-plan/search?type=penthouse",
          },
          {
            name: "Branded Residences",
            desc: "Premium residences created with globally recognised lifestyle and hospitality brands.",
            cta: "View branded residences",
            href: "/off-plan/search",
          },
        ],
      },
    },
    {
      key: "map",
      label: "Map explorer",
      description:
        "Map of off-plan projects by community, and the per-area project rails beneath it.",
      dataNote:
        "Pins and project cards come from published developments — an area's rail fills itself as projects are published to it. The copy and the two rail settings below are what's editable here.",
      fields: [
        eyebrow(),
        heading(),
        body({ max: 400 }),
        text("group_limit", "Projects per area", {
          max: 3,
          // A number the renderer parses. `numeral-drift` is script-blind, so
          // an Arabic-Indic "٣" would validate cleanly and parse to NaN.
          i18n: false,
          optional: true,
          help: "How many cards each area's rail holds, e.g. 12. Leave blank to include every published project — the rail scrolls either way.",
        }),
        text("group_cta_label", "Area link label", {
          max: 60,
          optional: true,
          help: 'Shown beside each area heading. Leave blank for "View all in <area>".',
        }),
      ],
      defaults: {
        eyebrow: "On the map",
        heading: "Explore new projects across Abu Dhabi.",
        body:
          "Zoom into a community and tap a project to open its details — or pick an area below to filter the launches.",
        // Blank on purpose: every project an area has published keeps showing,
        // exactly as before the rail existed. The cap is there for whoever
        // wants one, not imposed on a page that never had one.
        group_limit: null,
        group_cta_label: null,
      },
    },
    {
      key: "launches",
      label: "Latest launches",
      description: "Cards for featured developments.",
      dataNote:
        "Each card is a development project page — its name, price, area and cover image come from that record. Leave the list empty to show the most recent published projects.",
      fields: [
        eyebrow(),
        heading(),
        body(),
        ...ctaPair(),
        {
          key: "projects",
          label: "Featured projects",
          kind: "list",
          itemLabel: "project",
          max: 12,
          seedKey: "developments",
          help: "Pick the projects to feature, in the order they should appear.",
          fields: [
            toggle("enabled", "Show this project"),
            {
              key: "slug",
              label: "Project",
              kind: "select",
              optionsKey: "developments",
              placeholder: "Choose a development",
            },
          ],
        },
      ],
      defaults: {
        eyebrow: "New launch",
        heading: "Abu Dhabi's latest launches.",
        body: "Browse the newest and upcoming residential developments across the emirate.",
        cta_label: "View all developments",
        cta_href: "/developments",
        projects: [],
      },
    },
    {
      key: "locations",
      label: "Locations",
      description: "List of communities with project counts.",
      dataNote: "Counts come from published areas.",
      fields: [eyebrow(), heading(), body()],
      defaults: {
        eyebrow: "Abu Dhabi locations",
        heading: "Explore Abu Dhabi's leading communities.",
        body: "From waterfront destinations to family-friendly neighbourhoods — the areas shaping the emirate's off-plan market.",
      },
    },
    {
      key: "interest_form",
      label: "Project interest form",
      description: "Lead capture for a specific project brief.",
      dataNote:
        "The form's fields and project picker come from the interest-form component; the project list is every published development.",
      fields: [
        image(
          "image",
          "Photo",
          "Fills the right half of the card. Landscape renders work best. Leave unset for the placeholder art.",
        ),
      ],
      defaults: {
        image: emptyImage("off-plan development · architectural render"),
      },
    },
    {
      key: "why",
      label: "Why Bazar",
      description: "Trust band with stats.",
      fields: [
        heading({ key: "why_title", label: "Heading" }),
        area("why_body", "Body", { max: 900, optional: false }),
        statList(4),
      ],
      defaults: {
        why_title: "Off-plan, handled end to end.",
        why_body:
          "From first render to handover, Bazar advises on the launches worth your capital — payment plans, escrow protection, developer track record, and resale timing. One team, from reservation to keys.",
        stats: [
          { value: "78%", label: "H1 2026 sales off-plan" },
          { value: "40/60", label: "typical payment plans" },
          { value: "8", label: "leading communities" },
          { value: "2h", label: "advisor response" },
        ],
      },
    },
    {
      key: "faq",
      label: "FAQs",
      description: "Accordion of off-plan questions.",
      fields: [
        eyebrow({ key: "faq_eyebrow", label: "Eyebrow" }),
        heading({ key: "faq_title", label: "Heading" }),
        faqList(),
      ],
      defaults: {
        faq_eyebrow: "FAQ",
        faq_title: "Off-plan questions, answered.",
        items: [
          {
            q: "What does buying off-plan mean?",
            a: "You reserve a home before (or during) construction, directly from the developer. You typically pay in staged instalments through the build and take handover once the project completes — often at a lower entry price than a comparable ready home.",
          },
          {
            q: "How do payment plans work?",
            a: "Most Abu Dhabi launches spread the price across construction milestones — a common structure is 40% during the build and 60% on handover, though plans vary by developer and project. We break down each plan alongside the numbers before you commit.",
          },
          {
            q: "Is my money protected before handover?",
            a: "Yes. Off-plan payments are made into a developer's project escrow account, which is regulated so funds are released against verified construction progress rather than paid out up front. We confirm the escrow arrangement on every project we advise on.",
          },
          {
            q: "Can non-residents and foreigners buy off-plan?",
            a: "Yes — foreign buyers can own freehold in Abu Dhabi's designated investment zones, which cover most of the island communities where new projects launch. We'll confirm the ownership status of any project you're considering.",
          },
        ],
      },
    },
  ],
};

/**
 * /areas — the locations index.
 *
 * Defaults below are transcribed from the page and its three local components
 * (_components/area-cards, area-spotlights, community-types), which held their
 * copy as module constants. The chip lists inside community types are stored as
 * one-per-line text: a list field's sub-fields can only be scalars, so a nested
 * list isn't expressible in this model — and a textarea is easier to edit for
 * eight short names than eight rows of inputs would be.
 */
const AREAS: MasterPageDef = {
  key: "areas",
  label: "Areas",
  path: "/areas",
  description: "The locations index — area cards, spotlights and community types.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Eyebrow, headline and standfirst at the top of the page.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        body({ key: "subtitle", label: "Sub-headline" }),
      ],
      defaults: {
        eyebrow: "Abu Dhabi Locations",
        // The rendered headline breaks across two lines and italicises the last
        // word. Kept as one string here; the component owns the treatment.
        title: "Explore Abu Dhabi's leading communities.",
        subtitle:
          "From waterfront destinations to family-friendly neighbourhoods, discover the areas that define living and investing in the capital.",
      },
    },
    {
      key: "area_cards",
      label: "Abu Dhabi Locations",
      description: "The 4×2 grid of clickable area cards below the hero.",
      dataNote:
        "Listing counts always come from live data. Leave the card list empty to show the eight marquee areas automatically.",
      fields: [
        {
          key: "cards",
          label: "Area cards",
          kind: "list",
          itemLabel: "card",
          max: 12,
          seedKey: "areas",
          help: "Switch a card off to hide it without deleting it.",
          fields: [
            toggle("enabled", "Show this card"),
            text("name", "Title", { max: 80 }),
            link("href", "Link"),
            image("image", "Image"),
            text("slug", "Area slug", {
              max: 140,
              optional: true,
              // A lookup key, not a label. Folded into Arabic the area
              // resolves to nothing and the card silently disappears — a
              // failure an Arabic proofreader cannot see, because the Arabic
              // reads fine and what broke was the lookup.
              i18n: false,
              help: "Matches the live listing count to this card.",
            }),
          ],
        },
      ],
      defaults: { cards: [] },
    },
    {
      key: "all_areas",
      label: "All areas",
      description:
        "The complete A–Z index of every area and sub-community in the catalogue.",
      dataNote:
        "Generated from the catalogue — an area added in the CMS appears here automatically. Only the copy above the list is editable.",
      fields: [eyebrow(), heading(), body({ max: 400 })],
      defaults: {
        eyebrow: "Every community",
        heading: "The full Abu Dhabi index.",
        body: "Every area and sub-community we cover, with the number of homes listed in each right now.",
      },
    },
    {
      key: "area_map",
      label: "Area map",
      description: "Interactive map of Abu Dhabi communities.",
      dataNote:
        "Pins come from published areas and listings — only the copy above the map is editable here.",
      fields: [
        eyebrow(),
        heading(),
        body({ max: 400 }),
      ],
      defaults: {
        eyebrow: "Where to live",
        heading: "Find your area first. The home follows.",
        body: null,
      },
    },
    {
      key: "area_spotlights",
      label: "Area spotlights",
      description: "Two large editorial tiles for the areas being pushed hardest.",
      fields: [
        eyebrow(),
        heading(),
        area("sub", "Sub-heading", { max: 300 }),
        text("tile_eyebrow", "Eyebrow on each tile", { max: 40, optional: true }),
        {
          key: "items",
          label: "Spotlights",
          kind: "list",
          itemLabel: "spotlight",
          max: 4,
          fields: [
            toggle("enabled", "Show this spotlight"),
            text("name", "Area name", { max: 80 }),
            area("blurb", "Blurb", { max: 400 }),
            link("href", "Link"),
            image("image", "Image"),
            text("img", "Placeholder caption", { max: 80, optional: true }),
          ],
        },
      ],
      defaults: {
        eyebrow: "Area spotlights",
        heading: "Two islands worth a closer look.",
        sub: "Where demand, new supply, and lifestyle are converging right now.",
        tile_eyebrow: "Area Spotlight",
        items: [
          {
            enabled: true,
            name: "Hudayriyat Island",
            blurb:
              "Abu Dhabi's emerging waterfront destination — beaches, sports and leisure districts, and a new wave of low-rise coastal homes.",
            href: "/areas/hudayriyat-island",
            image: { media_id: null, alt: null, label: null },
            img: "hudayriyat island · coastline aerial",
          },
          {
            enabled: true,
            name: "Al Reem Island",
            blurb:
              "A vibrant, high-density waterfront community minutes from the city — strong rental demand and a deep mix of apartments and towers.",
            href: "/areas/al-reem-island",
            image: { media_id: null, alt: null, label: null },
            img: "al reem island · skyline waterfront",
          },
        ],
      },
    },
    {
      key: "list_your_property",
      label: "List your property",
      description: "Lead-capture band with the seller enquiry form.",
      dataNote: "The form fields themselves aren't editable here.",
      fields: [eyebrow(), heading(), body(), image("image", "Image")],
      defaults: {
        eyebrow: "List your property",
        heading: "List your property",
        body: "Looking to sell or rent? We'll handle the process for you.",
        image: { media_id: null, alt: null, label: null },
      },
    },
    {
      key: "community_types",
      label: "Community types",
      description:
        "Alternating image/copy rows — waterfront, gated, luxury, family.",
      fields: [
        eyebrow(),
        heading(),
        area("sub", "Sub-heading", { max: 300 }),
        {
          key: "items",
          label: "Community types",
          kind: "list",
          itemLabel: "type",
          max: 8,
          fields: [
            toggle("enabled", "Show this type"),
            text("name", "Name", { max: 80 }),
            area("tagline", "Tagline", { max: 400 }),
            area("about", "Supporting line", { max: 400 }),
            area("chips", "Communities", {
              max: 800,
              help: "One per line. Rendered as chips.",
            }),
            text("chips_label", "Chips heading", { max: 80, optional: true }),
            text("cta_label", "Button label", { max: 60, optional: true }),
            link("cta_href", "Button link"),
            image("image", "Image"),
            text("img", "Placeholder caption", { max: 80, optional: true }),
          ],
        },
      ],
      defaults: {
        eyebrow: "Community types",
        heading: "Find the setting that fits your life.",
        sub: "Every community has a character. Filter by the way you want to live.",
        items: [
          {
            enabled: true,
            name: "Waterfront Communities",
            tagline:
              "Explore communities designed around sea views, canals, promenades, and relaxed waterfront living.",
            about:
              "Designed around views, open spaces, and lifestyle convenience, waterfront communities remain highly desirable.",
            chips:
              "Mamsha Al Saadiyat\nHidd Al Saadiyat\nAl Muneera\nAl Bandar\nAl Zeina\nYas Acres\nReem Hills\nGardenia Bay",
            chips_label: "Popular waterfront communities",
            cta_label: "Explore waterfront communities",
            cta_href: "/areas",
            image: { media_id: null, alt: null, label: null },
            img: "waterfront promenade · canal",
          },
          {
            enabled: true,
            name: "Gated Communities",
            tagline:
              "Discover private residential communities offering security, comfort, and a more exclusive living environment.",
            about:
              "Gated communities are ideal for families seeking privacy, security, landscaped spaces, and everyday convenience.",
            chips:
              "Yas Acres\nSaadiyat Lagoons\nSaadiyat Reserve\nAl Raha Gardens\nReem Hills\nAl Ghadeer\nBloom Living\nHidd Al Saadiyat",
            chips_label: "Popular gated communities",
            cta_label: "Explore gated communities",
            cta_href: "/areas",
            image: { media_id: null, alt: null, label: null },
            img: "gated villa community · aerial",
          },
          {
            enabled: true,
            name: "Luxury Communities",
            tagline:
              "Explore Abu Dhabi's most premium addresses, offering high-end residences, exclusive amenities, and prime locations.",
            about:
              "Luxury communities offer premium homes, refined surroundings, privacy, and strong lifestyle appeal.",
            chips:
              "Mamsha Al Saadiyat\nHidd Al Saadiyat\nSaadiyat Lagoons\nSaadiyat Reserve\nNurai Island\nNobu Residences\nBaccarat Residences Saadiyat\nRamhan Island",
            chips_label: "Popular luxury communities",
            cta_label: "Explore luxury communities",
            cta_href: "/areas",
            image: { media_id: null, alt: null, label: null },
            img: "luxury residence · beachfront",
          },
          {
            enabled: true,
            name: "Family-Friendly Communities",
            tagline:
              "Find communities designed around comfort, convenience, space, and everyday family living.",
            about:
              "Family-friendly communities are ideal for those seeking space, convenience, and long-term comfort.",
            chips:
              "Yas Acres\nAl Raha Gardens\nBloom Living\nAl Ghadeer\nSaadiyat Lagoons\nNoya\nNoya Viva\nFay Al Reeman",
            chips_label: "Popular family-friendly communities",
            cta_label: "Explore family-friendly communities",
            cta_href: "/areas",
            image: { media_id: null, alt: null, label: null },
            img: "family townhouses · park",
          },
        ],
      },
    },
    {
      key: "why_bazar",
      label: "Why Bazar",
      description: "Navy band with the positioning statement and stats.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Heading" }),
        body(),
        statList(),
      ],
      defaults: {
        eyebrow: "Why Bazar",
        title: "Two decades of Abu Dhabi expertise, on your side.",
        body: "With over 20 years in the UAE market, Bazar pairs street-level knowledge of every Abu Dhabi community with developer relationships and honest, client-first guidance — so you choose an area with conviction, not guesswork.",
        stats: [
          { value: "20+ yrs", label: "In the UAE market" },
          { value: "Every district", label: "Abu Dhabi coverage" },
        ],
      },
    },
    {
      key: "faqs",
      label: "Areas FAQ",
      description: "Accordion of questions at the foot of the page.",
      fields: [
        eyebrow(),
        heading(),
        area("sub", "Sub-heading", { max: 300 }),
        faqList(),
      ],
      defaults: {
        eyebrow: "Areas FAQ",
        heading: "Questions about Abu Dhabi's areas.",
        sub: "The essentials on ownership, investment, and choosing where to live.",
        items: [
          {
            q: "Which are the best areas to invest in Abu Dhabi?",
            a: "It depends on your goal. Saadiyat Island and Al Reem Island are perennial favourites for capital appreciation and rental demand, while emerging destinations like Hudayriyat Island offer earlier entry points. Our advisors can match an area to your budget, timeline, and whether you're buying to live or to let.",
          },
          {
            q: "Can foreigners buy property in these areas?",
            a: "Yes. Abu Dhabi allows foreign nationals to own freehold property in designated investment zones, which cover most of the islands and communities featured here — including Saadiyat, Al Reem, Yas, and Al Raha Beach.",
          },
          {
            q: "What's the difference between an investment zone and a freehold area?",
            a: "In Abu Dhabi's designated investment zones, non-UAE nationals can hold freehold ownership of the property and the land. Elsewhere, foreign ownership is typically structured as long-term leasehold or usufruct. Every area guide notes its ownership terms.",
          },
          {
            q: "Which areas are best for families?",
            a: "Gated, low-rise communities with schools and parks nearby tend to suit families best — Yas Acres, Al Raha Gardens, Saadiyat Lagoons, and Bloom Living are common choices. Filter by the family-friendly community type above to see the full list.",
          },
          {
            q: "Which areas offer the strongest rental yields?",
            a: "Higher-density waterfront communities such as Al Reem Island typically post the strongest gross yields thanks to steady tenant demand, while premium addresses trade yield for capital growth. Each area guide shows median prices and recent market movement.",
          },
          {
            q: "How do I choose between a waterfront and a gated community?",
            a: "Waterfront communities lead on views, promenades, and lifestyle; gated communities lead on privacy, security, and space for families. Tell an advisor how you want to live and we'll shortlist areas that fit — often across both categories.",
          },
        ],
      },
    },
  ],
};

/**
 * The five marketing pages above predate the `sections/` split and stay in
 * this file. Everything added from Sprint 14 on lives in its own module —
 * this file was already 1300 lines, and one page per module keeps a change to
 * /about out of the diff for /buy.
 */
export const MASTER_PAGES: MasterPageDef[] = [
  HOME,
  BUY,
  RENT,
  COMMERCIAL,
  OFF_PLAN,
  AREAS,
  DEVELOPERS_PAGE,
  SERVICES_PAGE,
  INSIGHTS_PAGE,
  ABOUT_PAGE,
  CONTACT_PAGE,
  SELL_PAGE,
  PROPERTY_MANAGEMENT_PAGE,
  PROPERTY_CONSULTATION_PAGE,
  QR_PAGE,
  CONTACT_QR_PAGE,
  MORTGAGE_PAGE,
  // Appended, not inserted: `/admin/pages` lists this array in order, and
  // the two legal documents belong at the end of that list rather than above
  // the marketing pages an editor touches weekly.
  LEGAL_TERMS_PAGE,
  LEGAL_COOKIES_PAGE,
];
