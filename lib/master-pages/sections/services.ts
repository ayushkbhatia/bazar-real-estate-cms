/**
 * /services — the services index.
 *
 * The page is five "practices" (buy, sell, rent, manage, mortgage), each a
 * numbered band with an intro, a row of chips, and a numbered step flow. Each
 * practice is its own section rather than one big list field, for two reasons:
 * a list's sub-fields can only hold scalars, so the step flow — a list of
 * title/description pairs — isn't expressible inside one; and per-practice
 * sections let an editor reorder or switch off a single practice from the
 * section list without touching the others.
 *
 * The hero's chip row is not editable here: it is derived from the practice
 * sections themselves, so a practice switched off loses its chip automatically
 * and the numbers can never drift out of sync with the bands below.
 *
 * Every `defaults` value is the copy the page rendered before it became
 * editable, so an un-edited page renders byte-identically to before.
 */
import type { MasterPageDef, SectionDef } from "../types";
import {
  text,
  area,
  eyebrow,
  heading,
  body,
  ctaPair,
  faqList,
  statList,
} from "../fields";

type PracticeInput = {
  /** Section key — `practice_` prefixed, which is how the page finds them. */
  key: string;
  label: string;
  description: string;
  number: string;
  title: string;
  sub: string;
  helpLabel: string;
  help: string[];
  steps: [string, string][];
  ctaLabel: string;
  ctaHref: string;
};

/**
 * One practice band. The chip row is stored one label per line (see
 * `chipLines` in ../text) — the same treatment the /areas community types use,
 * and the only way to hold a flat list inside a section that already spends its
 * one list field on the step flow.
 */
function practiceSection(p: PracticeInput): SectionDef {
  return {
    key: p.key,
    label: p.label,
    description: p.description,
    fields: [
      text("number", "Number", {
        max: 8,
        // "01".."05". SHARED_RULES keeps Western digits in Arabic anyway, so
        // the best case is an identical twin and the worst is a numeral swap.
        i18n: false,
        help: "Shown above the title, and on the chip in the hero.",
      }),
      heading({ key: "title", label: "Title" }),
      body({ key: "sub", label: "Intro" }),
      text("help_label", "Chips heading", { max: 80 }),
      area("help", "Chips", {
        max: 800,
        optional: false,
        help: "One per line. Rendered as chips under the heading above.",
      }),
      text("steps_label", "Steps heading", { max: 80, optional: true }),
      {
        key: "steps",
        label: "Steps",
        kind: "list",
        itemLabel: "step",
        max: 10,
        help: "Numbered automatically, in the order listed here.",
        fields: [
          text("title", "Step", { max: 120 }),
          area("desc", "Description", { max: 300, optional: false }),
        ],
      },
      ...ctaPair("Button label"),
    ],
    defaults: {
      number: p.number,
      title: p.title,
      sub: p.sub,
      help_label: p.helpLabel,
      help: p.help.join("\n"),
      steps_label: "How we support you",
      steps: p.steps.map(([title, desc]) => ({ title, desc })),
      cta_label: p.ctaLabel,
      cta_href: p.ctaHref,
    },
  };
}

const PRACTICES: PracticeInput[] = [
  {
    key: "practice_buy",
    label: "01 · Buy a Property",
    description: "The buying practice — intro, what we help you buy, and the steps.",
    number: "01",
    title: "Buy a Property",
    sub: "Find the right property with confidence — residential, commercial, and land opportunities across Abu Dhabi's most sought-after communities.",
    helpLabel: "What we help you buy",
    help: [
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial",
      "Land",
      "Off-Plan",
      "Ready & Resale",
      "Investment",
    ],
    steps: [
      ["Understand your needs", "Location, budget, property type, and goals."],
      ["Shortlist properties", "Suitable options based on your requirements."],
      [
        "Provide market guidance",
        "Insight on value, demand, and growth potential.",
      ],
      ["Arrange viewings", "Clear property comparisons and viewing support."],
      ["Support the process", "Guidance from offer to completion."],
    ],
    ctaLabel: "Start a buying enquiry",
    ctaHref: "/buy",
  },
  {
    key: "practice_sell",
    label: "02 · Sell Your Property",
    description: "The selling practice — intro, what we help you sell, and the steps.",
    number: "02",
    title: "Sell Your Property",
    sub: "Looking to sell in Abu Dhabi? Our experts support you at every step — from valuation to closing.",
    helpLabel: "What we help you sell",
    help: [
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial",
      "Land",
      "Investment",
      "Ready & Resale",
    ],
    steps: [
      [
        "Property valuation",
        "Location, condition, size, view, demand and recent activity.",
      ],
      ["Pricing strategy", "A realistic price that attracts serious buyers."],
      ["Listing support", "Clear details and strong presentation."],
      ["Marketing exposure", "Promotion across suitable channels."],
      [
        "Buyer qualification",
        "We filter serious enquiries and arrange viewings.",
      ],
      ["Negotiation & closing", "Support from offer to completion."],
    ],
    ctaLabel: "Request a valuation",
    ctaHref: "/services/sell",
  },
  {
    key: "practice_rent",
    label: "03 · Rent a Property",
    description: "The rental practice — intro, what we help you rent, and the steps.",
    number: "03",
    title: "Rent a Property",
    sub: "Our team helps tenants find the right rental with clarity and confidence.",
    helpLabel: "What we help you rent",
    help: [
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial Spaces",
      "Offices",
      "Retail Units",
    ],
    steps: [
      ["Understand your needs", "Location, budget, size, and move-in date."],
      ["Shortlist rentals", "Suitable options based on your requirements."],
      ["Arrange viewings", "Viewing coordination and property comparisons."],
      ["Rental guidance", "Clear guidance on payments and tenancy details."],
      ["Move-in support", "Help with the next steps after selection."],
    ],
    ctaLabel: "Find a rental",
    ctaHref: "/rent",
  },
  {
    key: "practice_manage",
    label: "04 · Property Management",
    description:
      "The management practice — intro, what we help you manage, and the steps.",
    number: "04",
    title: "Property Management",
    sub: "Professional property management for landlords and investors — protect your asset and keep tenants satisfied.",
    helpLabel: "What we help you manage",
    help: [
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial Units",
      "Offices",
      "Retail Spaces",
      "Investment",
    ],
    steps: [
      ["Tenant coordination", "Communication and daily property matters."],
      ["Leasing support", "Tenant placement, renewals, and rental guidance."],
      ["Maintenance coordination", "Maintenance follow-up and support."],
      ["Inspections & updates", "Property checks and owner updates."],
      ["Documentation support", "Rental records and document coordination."],
      ["Owner support", "Ongoing support for landlords."],
    ],
    ctaLabel: "Request management support",
    ctaHref: "/services/manage",
  },
  {
    key: "practice_mortgage",
    label: "05 · Mortgage Support",
    description:
      "The mortgage practice — intro, who the service is for, and the steps.",
    number: "05",
    title: "Mortgage Support",
    sub: "Mortgage guidance for confident property decisions — know your budget early and search with focus.",
    helpLabel: "Who this service is for",
    help: [
      "First-time buyers",
      "UAE residents",
      "Non-resident buyers",
      "Investors",
      "End-users",
      "Cash vs. mortgage",
    ],
    steps: [
      ["Budget guidance", "Understand your buying power."],
      ["Pre-approval support", "Plan before selecting a property."],
      ["Banking coordination", "Connect with trusted mortgage partners."],
      ["Property matching", "Search based on your financing position."],
      ["Process support", "Guidance from search to completion."],
    ],
    ctaLabel: "Request mortgage guidance",
    ctaHref: "/tools/mortgage",
  },
];

export const SERVICES_PAGE: MasterPageDef = {
  key: "services",
  label: "Services",
  path: "/services",
  description:
    "The services index — the five practice bands, the trust band and the FAQs.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Eyebrow, headline and standfirst at the top of the page.",
      locked: true,
      dataNote:
        "The chip row under the standfirst is built from the practice sections below — their numbers and titles — so it stays in step when one is renamed, reordered or switched off.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        body({ key: "sub", label: "Sub-headline" }),
      ],
      defaults: {
        eyebrow: "What we do",
        // Rendered as two lines; the line break is the newline below and the
        // emphasised tail is italicised by the page.
        title: "Five practices,\none bench of",
        title_emphasis: "advisors.",
        sub: "Buy, sell, rent, manage, or finance — every service is backed by over 20 years of UAE market experience and a single, senior point of contact.",
      },
    },
    ...PRACTICES.map(practiceSection),
    {
      key: "why",
      label: "Why Bazar",
      description: "Navy band with the positioning statement and two stats.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Heading" }),
        body({ max: 900 }),
        statList(),
      ],
      defaults: {
        eyebrow: "Why Bazar",
        title: "Every practice, one senior partner on your file.",
        body: "Over 20 years of UAE real estate experience, direct developer and banking relationships, and client-focused guidance — combined so you make confident decisions whether you're buying, selling, renting, managing, or financing.",
        stats: [
          { value: "20+ yrs", label: "UAE market experience" },
          { value: "1", label: "senior partner per file" },
        ],
      },
    },
    {
      key: "faqs",
      label: "FAQs",
      description: "Accordion of questions at the foot of the page.",
      fields: [eyebrow(), heading(), faqList()],
      defaults: {
        eyebrow: "Common questions",
        heading: "Across every service.",
        items: [
          {
            q: "Can Bazar help me buy both ready and off-plan properties?",
            a: "Yes. We assist with ready, resale, and off-plan property purchases across Abu Dhabi and the wider UAE.",
          },
          {
            q: "How do I know how much my property is worth?",
            a: "Property value depends on location, size, condition, view, demand, and recent market activity. We provide a considered valuation before you list.",
          },
          {
            q: "Is property management useful for overseas landlords?",
            a: "Yes. It is especially helpful for owners who are not based near their property or prefer professional support.",
          },
          {
            q: "Can non-residents get a mortgage in the UAE?",
            a: "Some banks offer mortgage options for eligible non-residents, subject to bank criteria and approval. We connect you with suitable partners.",
          },
        ],
      },
    },
  ],
};
