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

/** One photo in a gallery set. */
const galleryPhoto = [
  { key: "image", label: "Photo", kind: "image" as const },
  {
    key: "caption",
    label: "Caption",
    kind: "text" as const,
    max: 120,
    optional: true,
  },
];

/**
 * Photo mosaic — `RendersGallery`, the "Project images" band from the project
 * pages: a lead photo with squares packed beside it, in one set or two side by
 * side.
 *
 * The photos are picked here rather than read from a project, because a
 * campaign's imagery is usually its own — lifestyle shots, a show apartment —
 * and the media library already holds every project render to choose from.
 */
export const gallery: BlockDef = {
  key: "gallery",
  label: "Photo gallery",
  description:
    "A mosaic of photos — a lead image with squares beside it — in one set, or two side by side such as interiors and exteriors.",
  group: "content",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 120 },
    { key: "intro", label: "Intro", kind: "textarea", max: 400, optional: true },
    { key: "first_heading", label: "First set — heading", kind: "text", max: 60 },
    {
      key: "first_images",
      label: "First set — photos",
      kind: "list",
      itemLabel: "photo",
      max: 9,
      help: "The first photo leads the set",
      fields: galleryPhoto,
    },
    {
      key: "second_heading",
      label: "Second set — heading",
      kind: "text",
      max: 60,
      optional: true,
    },
    {
      key: "second_images",
      label: "Second set — photos",
      kind: "list",
      itemLabel: "photo",
      max: 9,
      help: "Optional. Sits beside the first set on desktop, below it on a phone",
      fields: galleryPhoto,
    },
  ],
  // Photos can only be campaign-specific, and a photo row with no picture
  // chosen draws nothing — so the first set has to hold at least one real one.
  rowsRequired: { key: "first_images", itemKey: "image" },
  defaults: {
    eyebrow: "Explore the Project",
    heading: "Project Images",
    intro: null,
    first_heading: "Exterior Renders",
    first_images: [],
    second_heading: "Interior Renders",
    second_images: [],
  },
};

/**
 * Text-only cards — `ServiceValueGrid`. What an offer covers, who it is for.
 *
 * The image-led `prop_types` grid is the wrong tool for six or eight points
 * that have no photograph each; this is the grid /services/consultation uses
 * for exactly that.
 */
export const valueGrid: BlockDef = {
  key: "value_grid",
  label: "Value cards",
  description:
    "Text-only cards — a title and a line of copy each — for what an offer covers or who it is for. Two to four across on desktop.",
  group: "content",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120, optional: true },
    { key: "sub", label: "Sub-copy", kind: "textarea", max: 280, optional: true },
    {
      key: "cols",
      label: "Cards per row on desktop",
      kind: "select",
      options: [
        { value: "2", label: "Two" },
        { value: "3", label: "Three" },
        { value: "4", label: "Four" },
      ],
      help: "Always one per row on a phone, two on a tablet",
    },
    {
      key: "items",
      label: "Cards",
      kind: "list",
      itemLabel: "card",
      max: 12,
      fields: [
        { key: "name", label: "Title", kind: "text", max: 80 },
        { key: "desc", label: "Copy", kind: "textarea", max: 300 },
      ],
    },
  ],
  rowsRequired: { key: "items", itemKey: "name" },
  defaults: {
    eyebrow: "Who is it for?",
    title: "Guidance for Every Property Journey",
    sub: null,
    cols: "4",
    // The four audiences /services/consultation carries, verbatim.
    items: [
      {
        name: "First-Time Buyers",
        desc: "Understand the market and buying process before making your first property decision.",
      },
      {
        name: "Homebuyers",
        desc: "Find a property that fits your lifestyle, family and location requirements.",
      },
      {
        name: "Property Investors",
        desc: "Compare opportunities based on your objectives and preferred investment strategy.",
      },
      {
        name: "Property Owners",
        desc: "Understand your options before selling or making your next property move.",
      },
    ],
  },
};

/**
 * Headline figures with a source line — `AreaStatsBand`, the market-statistics
 * band from the area guides.
 *
 * Light, where `why_band` is a dark closing statement. The figures are typed,
 * not computed: market indices come from third parties on their own cadence,
 * so the footnote is where the editor says whose number it is and when.
 */
export const statsBand: BlockDef = {
  key: "stats_band",
  label: "Figures band",
  description:
    "A row of headline figures with a source line underneath — market data, yields, a launch in numbers.",
  group: "content",
  fields: [
    { key: "heading", label: "Heading", kind: "text", max: 120, optional: true },
    { key: "intro", label: "Intro", kind: "textarea", max: 400, optional: true },
    {
      key: "stats",
      label: "Figures",
      kind: "list",
      itemLabel: "figure",
      max: 8,
      help: "Three or six sit three across; any other count, four",
      fields: [
        { key: "value", label: "Figure", kind: "text", max: 24 },
        { key: "label", label: "Label", kind: "text", max: 60 },
      ],
    },
    {
      key: "footnote",
      label: "Source line",
      kind: "text",
      max: 240,
      optional: true,
      placeholder: "Source: DLD transactions, Q3 2026",
    },
  ],
  // The figures are the campaign's own claims; no default could be true.
  rowsRequired: { key: "stats", itemKey: "value" },
  defaults: {
    heading: "The market in numbers",
    intro: null,
    stats: [],
    footnote: null,
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
  gallery,
  valueGrid,
  statsBand,
];
