import type { MasterPageKey } from "./types";

/**
 * What each master page publishes to a search engine when nobody has edited it.
 *
 * These strings are not new — every one of them was a literal
 * `export const metadata` in its route file, which is where they had to be
 * before the CMS could hold them. They moved here rather than staying there
 * because two readers need them now: the route, which still publishes them
 * when the field is blank, and the CMS preview, which has to show the operator
 * what the page says *today* before they overwrite it. A preview that invented
 * its own placeholder would be lying about the starting state.
 *
 * Its own module rather than a field on `MasterPageDef`: `pages.ts` is 1,600
 * lines of section registry that several people edit at once, and seventeen
 * two-line additions scattered through it would collide with everything.
 *
 * `title` is the raw route declaration, without the root layout's
 * `%s · Bazar` template — `withTitleTemplate` applies that where a reader
 * needs to see the published form.
 */
export type MasterPageSeoDefault = {
  title: string;
  description: string;
  /**
   * True when the fallback title already reads as a finished page title and
   * must NOT take the root layout's `%s · Bazar` template.
   *
   * Only the home page: it publishes the layout's `title.default`, which is
   * the untemplated form. Letting the template run over it would append the
   * suffix to a title that has shipped without one since launch.
   */
  titleIsAbsolute?: boolean;
};

export const MASTER_PAGE_SEO_DEFAULTS: Record<
  MasterPageKey,
  MasterPageSeoDefault
> = {
  home: {
    // The one page that never declared its own: it inherits the root layout's
    // `title.default` and `description`, so those are its fallback.
    title: "Bazar Real Estate — Abu Dhabi, properly understood",
    description:
      "Bespoke real estate advisory and a curated marketplace for buyers, sellers, and investors across the United Arab Emirates.",
    titleIsAbsolute: true,
  },
  buy: {
    title: "Buy a Property in Abu Dhabi",
    description:
      "Find the right property with confidence — ready, resale and off-plan homes across Abu Dhabi's most sought-after communities, with a senior advisor guiding every step.",
  },
  rent: {
    title: "Rent a Property in Abu Dhabi",
    description:
      "Residential and commercial rentals across Abu Dhabi's most connected communities — matched to your budget, lifestyle, and move-in date.",
  },
  commercial: {
    title: "Commercial Property in Abu Dhabi",
    description:
      "Office, retail, and industrial leases and freeholds across Abu Dhabi's business districts — advised on whole cost of occupancy, not headline rent.",
  },
  "off-plan": {
    title: "New Projects · Off-plan in Abu Dhabi",
    description:
      "Explore the latest off-plan developments across Abu Dhabi's top communities — from waterfront apartments to branded residences.",
  },
  areas: {
    title: "Areas in Abu Dhabi",
    description:
      "From waterfront destinations to family-friendly neighbourhoods, discover the Abu Dhabi areas that define living and investing in the capital.",
  },
  developers: {
    title: "Developers · Bazar Real Estate",
    description:
      "Direct relationships with the UAE's leading developers give Bazar clients early access to landmark communities, new launches, and off-plan opportunities.",
  },
  services: {
    title: "Services · Bazar Real Estate",
    description:
      "Buy, sell, rent, manage, or finance — every service is backed by over 20 years of UAE market experience and a single, senior point of contact.",
  },
  insights: {
    title:
      "The Bazar Brief — market reports, field notes, and advisor commentary",
    description:
      "Long-form market analysis, advisor field notes, and the occasional contrarian take on Abu Dhabi real estate. One email every Wednesday.",
  },
  about: {
    title: "About Bazar Real Estate",
    description:
      "A trusted name in UAE real estate since 2005 — over 20 years of trust, transparency, and proven market experience across Abu Dhabi and the wider UAE.",
  },
  contact: {
    title: "Contact Bazar Real Estate",
    description:
      "Get in touch with Bazar Real Estate for buying, selling, renting, listing, or investment enquiries across Abu Dhabi and the UAE.",
  },
  sell: {
    title: "Sell or rent out your property in Abu Dhabi | Bazar",
    description:
      "Tell us about your property and we'll match you with the senior Bazar advisor who covers your community — ADREC-licensed, no upfront fees, one point of contact from valuation through to transfer.",
  },
  manage: {
    title: "Property Management in Abu Dhabi | Bazar",
    description:
      "Professional property management focused on protecting your property, supporting tenants and ensuring efficient day-to-day operations. Tell us about your property and a Bazar consultant will be in touch.",
  },
  consultation: {
    title: "Property Consultation in Abu Dhabi | Bazar",
    description:
      "Better property decisions start with the right guidance. Whether you are looking to buy, sell or invest, get professional property guidance based on your requirements, budget and objectives.",
  },
  qr: {
    title: "Scan to contact Bazar Real Estate",
    description:
      "A scannable code that opens Bazar Real Estate's contact page — for office screens, printed cards, and window displays.",
  },
  "contact-qr": {
    title: "Contact Bazar Real Estate",
    description:
      "You've scanned our code — save Bazar Real Estate to your phone in one tap, or call, WhatsApp or email an advisor in Abu Dhabi.",
  },
  "legal-privacy": {
    title: "Privacy policy",
    description:
      "How Bazar Real Estate L.L.C. collects, uses, stores, discloses, and protects personal data, issued under UAE PDPL (Federal Decree-Law No. 45 of 2021).",
  },
  "legal-terms": {
    title: "Terms of service",
    description:
      "Terms of service for Bazar Real Estate's marketplace, advisory, and tools.",
  },
  "legal-cookies": {
    title: "Cookie policy",
    description:
      "What Bazar Real Estate stores on your device, why, and how to change it.",
  },
  mortgage: {
    title: "Mortgage calculator",
    description:
      "All-in mortgage maths for Abu Dhabi: monthly payment, true cash to close (DLD, trustee, valuation, advisory), affordability check against Central Bank UAE DBR rules, and side-by-side scenario compare.",
  },
};
