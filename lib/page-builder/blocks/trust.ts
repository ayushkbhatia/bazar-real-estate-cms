import { emptyImage } from "@/lib/master-pages";
import type { BlockDef } from "../types";

/**
 * About Bazar — `WhoWeAre`.
 *
 * The default copy is the client's own audited wording, verbatim. It is the
 * registry default rather than a placeholder precisely so that adding this
 * block and changing nothing puts correct copy on the page.
 */
export const aboutBazar: BlockDef = {
  key: "about_bazar",
  label: "About Bazar",
  description:
    "Photo, company copy and a stat row. Ships with the audited wording.",
  group: "trust",
  singleton: true,
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 120 },
    { key: "body", label: "Copy", kind: "textarea", max: 900 },
    { key: "image", label: "Photo", kind: "image" },
    {
      key: "stats",
      label: "Stats",
      kind: "list",
      itemLabel: "stat",
      max: 4,
      help: "Empty keeps the three the section ships with.",
      fields: [
        { key: "value", label: "Figure", kind: "text", max: 24 },
        { key: "label", label: "Label", kind: "text", max: 40 },
      ],
    },
  ],
  defaults: {
    eyebrow: "Who we are",
    heading: "About Bazar Real Estate",
    body: "Established in 2005, Bazar Real Estate L.L.C. is a leading award-winning real estate agency in the UAE, recognized for its market expertise, professional excellence, and trusted presence in the region's ever-evolving property market.",
    image: emptyImage("bazar abu dhabi office"),
    stats: [],
  },
};

/** Dark closing statement with a stat grid — `WhyBand`. */
export const whyBand: BlockDef = {
  key: "why_band",
  label: "Why band",
  description:
    "A dark navy band with a serif statement and an optional stat grid. Used once, near the end.",
  group: "trust",
  singleton: true,
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Statement", kind: "text", max: 160 },
    { key: "body", label: "Copy", kind: "textarea", max: 600 },
    {
      key: "stats",
      label: "Stats",
      kind: "list",
      itemLabel: "stat",
      max: 4,
      help: "Two columns on the right. Empty hides the grid.",
      fields: [
        { key: "value", label: "Figure", kind: "text", max: 24 },
        { key: "label", label: "Label", kind: "text", max: 40 },
      ],
    },
  ],
  defaults: {
    eyebrow: "Why Bazar",
    title: "Twenty years of Abu Dhabi, properly understood.",
    body: "We advise on what to buy and what to leave — and we say so before the offer, not after.",
    stats: [],
  },
};

/**
 * Client reviews — `HomeTestimonials`.
 *
 * The one block in the catalogue whose *content* is not authored here. Every
 * other block owns its copy, which is right for a campaign page: it exists
 * nowhere else, so `document.ts` goes to some length to never lose it. A client
 * testimonial is the opposite — the same three quotes are already on the home
 * page, and a per-block copy would mean the site quoting one client two ways
 * the first time somebody fixed a typo on one page.
 *
 * So the quotes come from the section library (`lib/master-pages/library.ts`)
 * via `needs: ["testimonials"]`, and what an editor sets here is what belongs
 * to *this* page: the framing above the cards, and how many to show.
 */
export const testimonials: BlockDef = {
  key: "testimonials",
  label: "Testimonials",
  description:
    "Client review cards. The quotes are the shared set — edit them in Pages → Sub-pages → Sections.",
  group: "trust",
  singleton: true,
  needs: ["testimonials"],
  queryCost: 1,
  dataNote:
    "The reviews come from the Testimonials section library, so an edit there updates this page and every other one that shows them.",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 120 },
    {
      key: "limit",
      label: "How many to show",
      kind: "select",
      options: [
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "6", label: "6" },
      ],
      help: "Taken from the top of the shared list, skipping any review switched off.",
    },
  ],
  defaults: {
    eyebrow: "Testimonials",
    heading: "Reviews and comments",
    limit: "3",
  },
};

export const TRUST_BLOCKS = [aboutBazar, whyBand, testimonials];
