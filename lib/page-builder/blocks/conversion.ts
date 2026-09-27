import { emptyImage } from "@/lib/master-pages";
import { AD_COMMUNITIES } from "@/app/[locale]/(public)/_components/marketing/ad-data";
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
  rowsRequired: { key: "items", itemKey: "label" },
  defaults: {
    eyebrow: "Where",
    title: "Communities we know well",
    sub: null,
    // The eight the /buy and /rent chip clouds carry. Unlinked, as they are
    // there — a chip with no href renders as a plain pill rather than a dead
    // link, and a campaign usually wants them pointing at its own search.
    items: AD_COMMUNITIES.map((label) => ({ label, href: null })),
    icon: true,
    cta_label: null,
    cta_href: null,
  },
};

/**
 * The home page's repayment calculator — `MortgageCalculatorSection`.
 *
 * No data and no form: four sliders and the arithmetic in `lib/mortgage.ts`,
 * with its link through to the full tool. What an editor sets is the framing.
 */
export const mortgageCalculator: BlockDef = {
  key: "mortgage_calculator",
  label: "Mortgage calculator",
  description:
    "A dark band with four sliders — price, deposit, rate, term — and the monthly repayment they add up to. The one on the home page.",
  group: "conversion",
  singleton: true,
  fields: [
    { key: "eyebrow", label: "Eyebrow", kind: "text", max: 60, optional: true },
    { key: "heading", label: "Heading", kind: "text", max: 120 },
  ],
  // The home page's own wording, so the two read the same.
  defaults: {
    eyebrow: "Mortgage calculator",
    heading: "Estimate your monthly payments before making your move",
  },
};

/**
 * One advisor, face and number — `LeadAdvisorBanner`, the band that closes a
 * project page.
 *
 * The person — name, title, photograph, phone, WhatsApp — comes from their
 * team record, so a new photo or number reaches every campaign carrying them,
 * and an advisor who leaves the team drops off the page rather than leaving a
 * number that rings nobody. What the editor writes is what the card says
 * around them.
 */
export const advisor: BlockDef = {
  key: "advisor",
  label: "Advisor card",
  description:
    "One advisor on a dark card — photo, name, title and a quote — with buttons to call them or message them on WhatsApp.",
  group: "conversion",
  needs: ["advisor"],
  sharedQuery: "advisors",
  pickRequired: { key: "agent", noun: "advisor" },
  dataNote:
    "The name, title, photo and numbers come from the advisor's team record (/admin/agents). In the buttons and the message, {advisor_first} becomes their first name and {advisor} their full name.",
  fields: [
    {
      key: "agent",
      label: "Advisor",
      kind: "select",
      optionsKey: "agents",
      placeholder: "Choose an advisor",
    },
    { key: "heading", label: "Heading", kind: "text", max: 120, optional: true },
    {
      key: "intro",
      label: "Standfirst",
      kind: "textarea",
      max: 400,
      optional: true,
    },
    {
      key: "eyebrow",
      label: "Label above the name",
      kind: "text",
      max: 60,
      optional: true,
    },
    {
      key: "quote",
      label: "Pull quote",
      kind: "textarea",
      max: 300,
      optional: true,
    },
    { key: "call_label", label: "Call button", kind: "text", max: 60 },
    { key: "visit_label", label: "WhatsApp button", kind: "text", max: 60 },
    {
      key: "visit_message",
      label: "WhatsApp message",
      kind: "textarea",
      max: 300,
      // Required: blank, the card would fall back to its project-page wording
      // ("…book a site visit at <project>") with no project to name.
      optional: false,
    },
  ],
  // The project pages' advisor band, verbatim where it isn't about a project.
  defaults: {
    agent: null,
    heading: "Speak With an Advisor",
    intro: null,
    eyebrow: "Need Assistance?",
    quote: "We don't show twenty units. We show two — and we know why.",
    call_label: "Call {advisor_first}",
    visit_label: "Message on WhatsApp",
    visit_message: "Hi {advisor_first}, I'd like to know more.",
  },
};

export const CONVERSION_BLOCKS = [
  formBand,
  ctaBand,
  chips,
  mortgageCalculator,
  advisor,
];
