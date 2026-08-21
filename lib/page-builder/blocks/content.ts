import { emptyImage } from "@/lib/master-pages";
import { HOME_FAQ_ITEMS } from "@/lib/master-pages/pages";
import { SALE_PROP_TYPES } from "@/app/[locale]/(public)/_components/marketing/ad-data";
import type { BlockDef } from "../types";

/**
 * Starter rows.
 *
 * Every list-driven component in the catalogue renders *nothing* when its list
 * is empty — see the guards in `_render.tsx`. Shipping these blocks with
 * `items: []` therefore meant adding a section and getting a page that looks
 * exactly as it did before, which is what the `lead_gen` preset did: four
 * blocks, two of them invisible the moment they were published.
 *
 * So they ship filled, the way every master-page section does
 * (`lib/master-pages/pages.ts` — `categoryTiles`, `propTypeItems`,
 * `faqItems`). The copy is not invented for the catalogue: it is the wording
 * already live on /buy, /services and the home page, so an unedited block
 * states nothing the client has not already said in public.
 *
 * Blocks whose rows can only be campaign-specific — the feature rows, the
 * hand-picked listing rails — stay empty on purpose and lean on
 * `rowsRequired` instead: the editor flags them and the publish gate refuses.
 */

const TYPE_HREF: Record<string, string> = {
  Apartments: "/buy/search?type=apartment",
  Villas: "/buy/search?type=villa",
  Townhouses: "/buy/search?type=townhouse",
  Penthouses: "/buy/search?type=penthouse",
  "Commercial Properties": "/commercial",
};

/** Alternating image/copy rows — the project-page feature scroll. */
export const featureScroll: BlockDef = {
  key: "feature_scroll",
  label: "Feature rows",
  description:
    "Alternating image-and-copy rows that reveal as the visitor scrolls. The pattern from the project pages.",
  group: "content",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 120 },
    { key: "intro", label: "Intro", kind: "textarea", max: 280, optional: true },
    {
      key: "items",
      label: "Rows",
      kind: "list",
      itemLabel: "row",
      max: 8,
      help: "Each row flips the image to the other side.",
      fields: [
        { key: "kicker", label: "Small label", kind: "text", max: 40 },
        { key: "title", label: "Title", kind: "text", max: 80 },
        { key: "copy", label: "Copy", kind: "textarea", max: 600 },
        { key: "image", label: "Photo", kind: "image" },
      ],
    },
  ],
  // Deliberately empty: what sets *this* campaign apart is the one thing no
  // default can supply. The editor row says so and the gate refuses to publish
  // it blank, which is the honest version of shipping invented copy.
  rowsRequired: { key: "items", itemKey: "title" },
  defaults: {
    eyebrow: "The detail",
    heading: "What sets it apart",
    intro: null,
    items: [],
  },
};

/** Full-bleed image tiles with overlaid copy — `CategoryTiles`. */
export const tiles: BlockDef = {
  key: "tiles",
  label: "Image tiles",
  description:
    "Four photo tiles with a headline and a link on each. 1-up on mobile, 2-up on tablet, 4-up on desktop.",
  group: "content",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120, optional: true },
    {
      key: "items",
      label: "Tiles",
      kind: "list",
      itemLabel: "tile",
      max: 8,
      fields: [
        { key: "name", label: "Title", kind: "text", max: 60 },
        { key: "desc", label: "Copy", kind: "textarea", max: 200 },
        { key: "cta", label: "Link text", kind: "text", max: 40 },
        { key: "href", label: "Link", kind: "link" },
        { key: "image", label: "Photo", kind: "image" },
      ],
    },
  ],
  rowsRequired: { key: "items", itemKey: "name" },
  defaults: {
    eyebrow: "Ways to browse",
    title: "Start where it suits you",
    // The four tiles /buy ships with, verbatim.
    items: [
      {
        name: "Off-Plan Properties",
        desc: "New launches with structured payment plans.",
        cta: "Browse off-plan",
        href: "/off-plan",
        image: emptyImage("off-plan tower · render"),
      },
      {
        name: "Resale Properties",
        desc: "Established homes ready for handover.",
        cta: "Browse resale",
        href: "/buy/search",
        image: emptyImage("resale apartment"),
      },
      {
        name: "Ready-to-Move Properties",
        desc: "Vacant, keys-in-hand homes.",
        cta: "Browse ready",
        href: "/buy/search",
        image: emptyImage("ready villa · interior"),
      },
      {
        name: "Commercial Properties",
        desc: "Offices, retail and land.",
        cta: "Browse commercial",
        href: "/commercial",
        image: emptyImage("commercial tower"),
      },
    ],
  },
};

/** Card grid with a media ratio you choose — `PropTypeGrid`. */
export const propTypes: BlockDef = {
  key: "prop_types",
  label: "Card grid",
  description:
    "Photo-and-copy cards in a three, four or five column grid. Used for property types and services.",
  group: "content",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120, optional: true },
    {
      key: "cols",
      label: "Columns on desktop",
      kind: "select",
      options: [
        { value: "3", label: "Three" },
        { value: "4", label: "Four" },
        { value: "5", label: "Five" },
      ],
      help: "Always one column on mobile, two on tablet",
    },
    {
      key: "aspect",
      label: "Photo shape",
      kind: "select",
      options: [
        { value: "4/3", label: "Landscape (4:3)" },
        { value: "1/1", label: "Square" },
        { value: "3/4", label: "Portrait (3:4)" },
      ],
    },
    {
      key: "items",
      label: "Cards",
      kind: "list",
      itemLabel: "card",
      max: 10,
      fields: [
        { key: "name", label: "Title", kind: "text", max: 60 },
        { key: "desc", label: "Copy", kind: "textarea", max: 240 },
        { key: "cta", label: "Link text", kind: "text", max: 40, optional: true },
        { key: "href", label: "Link", kind: "link", optional: true },
        { key: "image", label: "Photo", kind: "image" },
      ],
    },
  ],
  rowsRequired: { key: "items", itemKey: "name" },
  defaults: {
    eyebrow: "What's available",
    title: "Property types",
    cols: "3",
    aspect: "4/3",
    // The same five cards the /buy and /rent grids carry.
    items: SALE_PROP_TYPES.map(([name, desc]) => ({
      name,
      desc,
      cta:
        name === "Commercial Properties"
          ? "Browse commercial"
          : `Browse ${name.toLowerCase()}`,
      href: TYPE_HREF[name] ?? "/buy/search",
      image: emptyImage(name.toLowerCase()),
    })),
  },
};

/** Numbered two-column step list — `StepFlow`. */
export const steps: BlockDef = {
  key: "steps",
  label: "How it works",
  description: "A numbered list of steps, two columns on desktop.",
  group: "content",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120, optional: true },
    {
      key: "items",
      label: "Steps",
      kind: "list",
      itemLabel: "step",
      max: 8,
      fields: [
        { key: "title", label: "Step", kind: "text", max: 80 },
        { key: "desc", label: "Detail", kind: "textarea", max: 300 },
      ],
    },
  ],
  rowsRequired: { key: "items", itemKey: "title" },
  defaults: {
    eyebrow: "How it works",
    title: "From first call to keys",
    // The buying flow as /services states it.
    items: [
      {
        title: "Understand your needs",
        desc: "Location, budget, property type, and goals.",
      },
      {
        title: "Shortlist properties",
        desc: "Suitable options based on your requirements.",
      },
      {
        title: "Provide market guidance",
        desc: "Insight on value, demand, and growth potential.",
      },
      {
        title: "Arrange viewings",
        desc: "Clear property comparisons and viewing support.",
      },
      { title: "Support the process", desc: "Guidance from offer to completion." },
    ],
  },
};

/**
 * Q&A list — `Faq`.
 *
 * Native `<details>`/`<summary>`, so it is keyboard- and screen-reader-
 * accessible with no client JavaScript at all.
 */
export const faq: BlockDef = {
  key: "faq",
  label: "FAQ",
  description: "Numbered questions that expand in place. No JavaScript.",
  group: "content",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120, optional: true },
    {
      key: "items",
      label: "Questions",
      kind: "list",
      itemLabel: "question",
      max: 12,
      fields: [
        { key: "q", label: "Question", kind: "text", max: 160 },
        { key: "a", label: "Answer", kind: "textarea", max: 900 },
      ],
    },
  ],
  rowsRequired: { key: "items", itemKey: "q" },
  defaults: {
    eyebrow: "Questions",
    title: "Frequently asked",
    // The home page's five, so a campaign page answers what the site already
    // answers rather than a second, subtly different set.
    items: HOME_FAQ_ITEMS.map((item) => ({ q: item.q, a: item.a })),
  },
};

/** A plain band of prose. */
export const richText: BlockDef = {
  key: "rich_text",
  label: "Text block",
  description: "A heading and a run of copy. For anything the other blocks don't cover.",
  group: "content",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120, optional: true },
    { key: "body", label: "Copy", kind: "textarea", max: 4000 },
    {
      key: "align",
      label: "Alignment",
      kind: "select",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Centred" },
      ],
    },
    {
      key: "tone",
      label: "Background",
      kind: "select",
      options: [
        { value: "bg", label: "Page background" },
        { value: "surface", label: "Raised surface" },
      ],
    },
  ],
  defaults: {
    eyebrow: null,
    title: "A heading",
    body: "Copy goes here.",
    align: "left",
    tone: "bg",
  },
};

/** Full-bleed photo band with an optional caption. */
export const imageBand: BlockDef = {
  key: "image_band",
  label: "Photo band",
  description: "A single full-width photograph, with an optional caption.",
  group: "content",
  fields: [
    { key: "image", label: "Photo", kind: "image" },
    { key: "caption", label: "Caption", kind: "text", max: 160, optional: true },
    {
      key: "height",
      label: "Height",
      kind: "select",
      options: [
        { value: "short", label: "Short (280px)" },
        { value: "tall", label: "Tall (480px)" },
      ],
    },
  ],
  defaults: {
    image: emptyImage("abu dhabi · skyline"),
    caption: null,
    height: "short",
  },
};

export const CONTENT_BLOCKS = [
  featureScroll,
  tiles,
  propTypes,
  steps,
  faq,
  richText,
  imageBand,
];
