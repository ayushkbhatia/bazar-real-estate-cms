import { emptyImage } from "@/lib/master-pages";
import type { BlockDef } from "../types";

/** Copy + photo + live lead form — `LeadBand`. */
export const formBand: BlockDef = {
  key: "form_band",
  label: "Lead form band",
  description:
    "A second enquiry surface further down the page — copy and photo beside a live form.",
  group: "conversion",
  needs: ["form"],
  dataNote:
    "The form's fields, button and confirmation are edited in Forms (/admin/forms), not here.",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120 },
    { key: "sub", label: "Sub-copy", kind: "textarea", max: 280 },
    { key: "image", label: "Photo", kind: "image" },
    {
      key: "form_key",
      label: "Form",
      kind: "select",
      optionsKey: "forms",
      placeholder: "Choose a form",
    },
  ],
  defaults: {
    eyebrow: "Get in touch",
    title: "Talk to an advisor",
    sub: "Tell us what you're after and we'll come back with a shortlist that fits.",
    image: emptyImage("bazar advisory"),
    form_key: "contact_enquiry",
  },
};

/**
 * Closing call to action.
 *
 * Written fresh rather than prop-ifying the orphaned `_components/cta-banner`:
 * that one imports `ValuationLeadGate` from the valuation tool, and a generic
 * catalogue block must not drag a stateful feature component behind it.
 */
export const ctaBand: BlockDef = {
  key: "cta_band",
  label: "Call to action",
  description: "A closing band with one or two buttons.",
  group: "conversion",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120 },
    { key: "body", label: "Copy", kind: "textarea", max: 400, optional: true },
    { key: "cta_label", label: "Button", kind: "text", max: 40 },
    { key: "cta_href", label: "Button link", kind: "link" },
    {
      key: "cta2_label",
      label: "Second button",
      kind: "text",
      max: 40,
      optional: true,
    },
    { key: "cta2_href", label: "Second link", kind: "link", optional: true },
    {
      key: "variant",
      label: "Treatment",
      kind: "select",
      options: [
        { value: "ink", label: "Navy — high contrast" },
        { value: "accent", label: "Teal tint" },
        { value: "soft", label: "Quiet — page background" },
      ],
      help: "A closed set, so the copy can never end up unreadable.",
    },
  ],
  defaults: {
    eyebrow: null,
    title: "Ready when you are",
    body: "One conversation is usually enough to know whether we're the right fit.",
    cta_label: "Speak to an advisor",
    cta_href: "/contact",
    cta2_label: null,
    cta2_href: null,
    variant: "ink",
  },
};

/** Pill cloud of links — `ChipCloud`. */
export const chips: BlockDef = {
  key: "chips",
  label: "Link chips",
  description: "A cloud of pill links — areas, communities, property types.",
  group: "conversion",
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "title", label: "Heading", kind: "text", max: 120, optional: true },
    { key: "sub", label: "Sub-copy", kind: "textarea", max: 280, optional: true },
    {
      key: "items",
      label: "Chips",
      kind: "list",
      itemLabel: "chip",
      max: 24,
      fields: [
        { key: "label", label: "Label", kind: "text", max: 48 },
        { key: "href", label: "Link", kind: "link", optional: true },
      ],
    },
    {
      key: "icon",
      label: "Pin icon on each chip",
      kind: "toggle",
    },
    { key: "cta_label", label: "Button", kind: "text", max: 40, optional: true },
    { key: "cta_href", label: "Button link", kind: "link", optional: true },
  ],
  defaults: {
    eyebrow: "Where",
    title: "Communities we know well",
    sub: null,
    items: [],
    icon: true,
    cta_label: null,
    cta_href: null,
  },
};

export const CONVERSION_BLOCKS = [formBand, ctaBand, chips];
