import type { MasterPageDef } from "../types";
import {
  text,
  area,
  link,
  image,
  toggle,
  eyebrow,
  heading,
  body,
  chipList,
} from "../fields";

/**
 * /about — the company page.
 *
 * Every `defaults` value below is the copy the page rendered before it became
 * editable, character for character, so an untouched page is byte-identical to
 * what shipped. Keep them in sync with app/[locale]/(public)/about/page.tsx: the module
 * constants there (VALUES, EXPERTISE, PARTNERS, HIGHLIGHTS) survive only as
 * fallbacks for an empty list.
 *
 * The value, footprint and partner rows are hand-written editorial, not a feed,
 * so they are list fields the editor owns outright. The partner-ecosystem
 * marquee and the HQ map are not: both are shared code surfaces, declared here
 * with no fields so they can still be reordered or switched off.
 */
export const ABOUT_PAGE: MasterPageDef = {
  key: "about",
  label: "About",
  path: "/about",
  description:
    "The company page — who Bazar is, what it stands on, and where it operates.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Headline, opening paragraphs and the office photo.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Headline · italic tail", {
          max: 60,
          optional: true,
          help: "Rendered in italics at the end of the headline.",
        }),
        text("meta", "Strapline", { max: 80, optional: true }),
        body({ key: "body_1", label: "First paragraph" }),
        body({ key: "body_2", label: "Second paragraph" }),
        image("photo", "Office photo", "Shown beside the headline, 4:3."),
        // Declared inline because there is no `file()` builder — same shape as
        // the development brochure (lib/master-pages/subpages.ts), which is
        // the only other file field in the registry.
        {
          key: "profile",
          label: "Company profile PDF",
          kind: "file",
          help: "Adds a download button under the intro copy. Leave it empty and no button renders. Max 10 MB.",
        },
        text("profile_label", "Profile button label", {
          max: 60,
          optional: true,
          help: "Blank keeps “Download company profile”.",
        }),
      ],
      defaults: {
        eyebrow: "About Bazar Real Estate",
        // The headline breaks after "UAE"; the tail below it is italicised.
        title: "A trusted name in UAE\nreal estate",
        title_emphasis: "since 2005.",
        meta: "Established Abu Dhabi · 2005",
        body_1:
          "Established in Abu Dhabi in 2005, Bazar Real Estate L.L.C. is a leading award-winning real estate agency in the UAE, built on over 20 years of trust, transparency, and proven market experience.",
        body_2:
          "With deep roots in Abu Dhabi and a growing presence across the wider UAE, Bazar has developed a trusted reputation for market expertise, professional excellence, and strong industry relationships in one of the region's most dynamic real estate markets.",
        photo: {
          media_id: null,
          alt: null,
          label: "bazar office · al bateen · abu dhabi",
        },
        // No PDF ships with the page, so the button starts absent and /about
        // renders exactly as it did before this field existed.
        profile: { media_id: null, alt: null, label: null },
        profile_label: null,
      },
    },
    {
      key: "story",
      label: "Beyond property & Our story",
      description: "The two editorial columns under the hero.",
      fields: [
        {
          key: "columns",
          label: "Columns",
          kind: "list",
          itemLabel: "column",
          max: 2,
          help: "Two columns sit side by side on desktop.",
          fields: [
            toggle("enabled", "Show this column"),
            text("eyebrow", "Eyebrow", { max: 60 }),
            text("title", "Heading", { max: 120 }),
            area("body", "Paragraphs", {
              max: 1200,
              help: "Leave a blank line between paragraphs.",
            }),
          ],
        },
      ],
      defaults: {
        columns: [
          {
            enabled: true,
            eyebrow: "Beyond property",
            title: "A partner, not just a broker.",
            body: "At Bazar Real Estate, we go beyond property transactions. We act as a trusted partner for clients navigating Abu Dhabi and the wider UAE real estate market, combining local expertise with a modern, investor-focused approach.\n\nWith direct relationships with leading developers, financial partners, and key industry stakeholders, Bazar provides clients with the knowledge, access, and confidence needed to make informed property decisions.",
          },
          {
            enabled: true,
            eyebrow: "Our story",
            title: "Twenty years, built on the ground.",
            body: "Founded in Abu Dhabi in 2005 by Azmi Mohamdin, Bazar Real Estate was built on deep, hands-on knowledge of the local property market.\n\nOver the years, the company has grown into a trusted real estate partner, known for clear guidance, market insight, professionalism, transparency, and long-term value. Our journey reflects the growth of the UAE property sector itself — from established communities to landmark developments and emerging investment destinations.",
          },
        ],
      },
    },
    {
      key: "mission",
      label: "Our mission",
      description: "The centred navy band with the mission statement.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Mission statement", max: 240 }),
        body({ max: 400 }),
      ],
      defaults: {
        eyebrow: "Our mission",
        title:
          "To guide clients through the UAE real estate market with clarity, integrity, and strategic insight.",
        body: "Drawing on over 20 years of local expertise, strong developer relationships, and in-depth market knowledge, we deliver tailored property guidance that creates lasting value and a seamless client experience.",
      },
    },
    {
      key: "values",
      label: "Our values",
      description: "The numbered row of company values.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Heading" }),
        {
          key: "items",
          label: "Values",
          kind: "list",
          itemLabel: "value",
          // Five columns on desktop — a sixth value wraps onto its own row.
          max: 5,
          help: "Numbered 01, 02, … in the order listed here.",
          fields: [
            toggle("enabled", "Show this value"),
            text("name", "Name", { max: 60 }),
            area("desc", "Description", { max: 200 }),
          ],
        },
      ],
      defaults: {
        eyebrow: "Our values",
        title: "What we stand on.",
        items: [
          {
            enabled: true,
            name: "Trust",
            desc: "Transparency, reliability, and long-term confidence.",
          },
          {
            enabled: true,
            name: "Excellence",
            desc: "Premium standards across every client experience.",
          },
          {
            enabled: true,
            name: "Access",
            desc: "Strong connections with developers, banks, and industry partners.",
          },
          {
            enabled: true,
            name: "Customer Focus",
            desc: "Client satisfaction, success, and long-term value.",
          },
          {
            enabled: true,
            name: "Innovation",
            desc: "Smart solutions for evolving market needs.",
          },
        ],
      },
    },
    {
      key: "footprint",
      label: "Our footprint",
      description: "Two picture cards for the markets Bazar covers.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Heading" }),
        {
          key: "cards",
          label: "Market cards",
          kind: "list",
          itemLabel: "card",
          max: 4,
          fields: [
            toggle("enabled", "Show this card"),
            text("tag", "Eyebrow", { max: 60 }),
            text("name", "Title", { max: 80 }),
            area("desc", "Description", { max: 400 }),
            image("image", "Image", "Falls back to the placeholder caption."),
            text("img", "Placeholder caption", { max: 80, optional: true }),
          ],
        },
      ],
      defaults: {
        eyebrow: "Our footprint",
        title: "Rooted in Abu Dhabi, reaching the wider UAE.",
        cards: [
          {
            enabled: true,
            tag: "Our home market",
            name: "Abu Dhabi",
            desc: "Abu Dhabi is our home market and core area of expertise. From prime island communities to the heart of the city, Bazar covers residential, investment, and commercial opportunities across the capital.",
            image: { media_id: null, alt: null, label: null },
            img: "abu dhabi · corniche",
          },
          {
            enabled: true,
            tag: "Selected opportunities",
            name: "Dubai & Wider UAE",
            desc: "Expanding beyond Abu Dhabi, Bazar connects clients to selected opportunities across Dubai and other key UAE markets — established communities, new developments, and investment-focused destinations.",
            image: { media_id: null, alt: null, label: null },
            img: "dubai skyline",
          },
        ],
      },
    },
    {
      key: "expertise",
      label: "Expertise & track record",
      description:
        "Service chips on the left, the ticked track-record list on the right.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Heading" }),
        body(),
        chipList("chips", "Expertise chips", 16),
        text("cta_label", "Button label", { max: 60, optional: true }),
        link("cta_href", "Button link"),
        text("track_eyebrow", "Track record · eyebrow", { max: 60 }),
        {
          key: "items",
          label: "Track record",
          kind: "list",
          itemLabel: "point",
          max: 10,
          help: "Each point gets a tick and its own row.",
          fields: [text("label", "Point", { max: 120 })],
        },
      ],
      defaults: {
        eyebrow: "Our areas of expertise",
        title: "Where our knowledge runs deep.",
        body: "We combine market expertise, strong industry relationships, and a client-focused approach to support buyers, investors, landlords, sellers, and tenants across the UAE.",
        chips: [
          { label: "Off-Plan Sales", href: null },
          { label: "Secondary Market", href: null },
          { label: "Listing Services", href: null },
          { label: "Property Investment", href: null },
          { label: "Property Management", href: null },
          { label: "Real Estate Consulting", href: null },
          { label: "Luxury Properties", href: null },
          { label: "Commercial Real Estate", href: null },
          { label: "Mortgage & Banking Guidance", href: null },
        ],
        cta_label: "Our services",
        cta_href: "/services",
        track_eyebrow: "Our track record",
        items: [
          { label: "Established in 2005" },
          { label: "Two decades of experience" },
          { label: "Award-winning UAE agency" },
          { label: "Strong Abu Dhabi presence" },
          { label: "Experienced local team" },
          { label: "Trusted developer relationships" },
        ],
      },
    },
    {
      key: "partners",
      label: "Developer partners",
      description: "The grid of developer names Bazar works with.",
      dataNote:
        "These names are typed here, not pulled from the developer records. The button links to the live developer directory.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Heading" }),
        text("cta_label", "Button label", { max: 60, optional: true }),
        link("cta_href", "Button link"),
        chipList("items", "Developer names", 18),
      ],
      defaults: {
        eyebrow: "Our developer partners",
        title: "Trusted by the region's builders.",
        cta_label: "All developers",
        cta_href: "/developers",
        items: [
          { label: "Aldar Properties", href: null },
          { label: "Modon Properties", href: null },
          { label: "Bloom Holding", href: null },
          { label: "IMKAN Properties", href: null },
          { label: "Reportage Properties", href: null },
          { label: "Eagle Hills", href: null },
          { label: "Radiant Real Estate", href: null },
          { label: "Ohana Development", href: null },
          { label: "Taraf", href: null },
        ],
      },
    },
    {
      key: "partner_ecosystem",
      label: "Partner ecosystem",
      description: "The bank and regulator logo marquee.",
      dataNote:
        "Shared with the home page — its copy and logos are set in code, so editing it here isn't possible. It can still be moved or switched off.",
      fields: [],
      defaults: {},
    },
    {
      key: "location",
      label: "Our location",
      description: "Head-office address, directions buttons and the HQ map.",
      dataNote:
        "The map pin and the Get directions link use the fixed head-office coordinates set in code.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Heading" }),
        text("company", "Company name", { max: 80 }),
        area("address", "Address", {
          max: 300,
          help: "One line per line of the address.",
        }),
        text("directions_label", "Directions button label", { max: 60 }),
        text("cta_label", "Second button label", { max: 60, optional: true }),
        link("cta_href", "Second button link"),
      ],
      defaults: {
        eyebrow: "Our location",
        title: "Based in Abu Dhabi, serving the UAE.",
        company: "Bazar Real Estate L.L.C.",
        address:
          "Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates",
        directions_label: "Get directions",
        cta_label: "Contact us",
        cta_href: "/contact",
      },
    },
  ],
};
