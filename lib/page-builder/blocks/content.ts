import { emptyImage } from "@/lib/master-pages";
import type { BlockDef } from "../types";

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
  defaults: {
    eyebrow: "Ways to browse",
    title: "Start where it suits you",
    items: [],
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
  defaults: {
    eyebrow: "What's available",
    title: "Property types",
    cols: "3",
    aspect: "4/3",
    items: [],
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
  defaults: {
    eyebrow: "How it works",
    title: "From first call to keys",
    items: [],
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
  defaults: {
    eyebrow: "Questions",
    title: "Frequently asked",
    items: [],
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
