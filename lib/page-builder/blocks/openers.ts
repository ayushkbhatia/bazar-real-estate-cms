import { emptyImage } from "@/lib/master-pages";
import type { BlockDef } from "../types";

/**
 * Openers — the first thing a visitor sees.
 *
 * Both render an `<h1>`, so the publish gate's "exactly one H1" check is what
 * stops a page leading with two. Both are `singleton`, so the picker won't
 * offer a second of the same kind.
 */

/** Full-bleed photographic hero — `MHero`, the /off-plan lead. */
export const heroMedia: BlockDef = {
  key: "hero_media",
  label: "Media hero",
  description:
    "Full-bleed photo, headline over a scrim, optional stat row along the bottom.",
  group: "opener",
  singleton: true,
  opener: true,
  providesH1: true,
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Headline", kind: "text", max: 120 },
    {
      key: "sub",
      label: "Sub-copy",
      kind: "textarea",
      max: 280,
      optional: true,
    },
    {
      key: "image",
      label: "Hero photo",
      kind: "image",
      help: "Full-bleed behind the headline",
    },
    {
      key: "tall",
      label: "Taller hero",
      kind: "toggle",
      help: "620px instead of 520px",
    },
    {
      key: "stats",
      label: "Stat row",
      kind: "list",
      itemLabel: "stat",
      max: 4,
      help: "Sits along the bottom of the hero. Leave empty to hide it.",
      fields: [
        { key: "value", label: "Figure", kind: "text", max: 24 },
        { key: "label", label: "Label", kind: "text", max: 40 },
      ],
    },
  ],
  defaults: {
    eyebrow: "Abu Dhabi",
    title: "A headline for the campaign",
    sub: null,
    image: emptyImage("abu dhabi · corniche skyline"),
    tall: false,
    stats: [],
  },
};

/** Copy left, lead card right — `ServiceHero`. Form-first on mobile. */
export const heroForm: BlockDef = {
  key: "hero_form",
  label: "Hero with lead form",
  description:
    "Headline beside a live lead form. On mobile the form comes first, so a visitor lands on the first question.",
  group: "opener",
  singleton: true,
  opener: true,
  providesH1: true,
  needs: ["form"],
  dataNote:
    "The form's fields, button and confirmation are edited in Forms (/admin/forms), not here.",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    {
      key: "title",
      label: "Headline",
      kind: "textarea",
      max: 120,
      help: "One line per row",
    },
    {
      key: "title_emphasis",
      label: "Italic tail",
      kind: "text",
      max: 60,
      optional: true,
      help: "Set in italics after the headline",
    },
    {
      key: "lede",
      label: "Lede",
      kind: "textarea",
      max: 160,
      optional: true,
      help: "The larger line under the headline",
    },
    { key: "sub", label: "Sub-copy", kind: "textarea", max: 280, optional: true },
    { key: "image", label: "Background photo", kind: "image" },
    {
      key: "form_key",
      label: "Form",
      kind: "select",
      optionsKey: "forms",
      placeholder: "Choose a form",
      help: "Which lead form the card shows",
    },
  ],
  defaults: {
    eyebrow: "Speak to an advisor",
    title: "Tell us what you're\nlooking for",
    title_emphasis: null,
    lede: null,
    sub: "One brief, one advisor, and a shortlist that actually fits.",
    image: emptyImage("abu dhabi · waterfront"),
    form_key: "contact_enquiry",
  },
};

export const OPENER_BLOCKS = [heroMedia, heroForm];
