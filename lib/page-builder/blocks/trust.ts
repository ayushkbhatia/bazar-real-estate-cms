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

export const TRUST_BLOCKS = [aboutBazar, whyBand];
