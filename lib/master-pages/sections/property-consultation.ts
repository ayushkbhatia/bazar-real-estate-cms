/**
 * /services/consultation — the Property Consultation landing.
 *
 * A new route. The Services megamenu has carried a "Property Consultation"
 * column for a while, but it pointed at /services/manage — so the two entries
 * under Services led to the same page, and the consultation offer had no page
 * of its own at all.
 *
 * Structure follows the client's content document: hero + lead form, the five
 * "how we can help" tiles that hand off into the catalogue, what the
 * consultation covers, who it is for, and the closing CTA. Every `defaults`
 * string is the document's copy.
 *
 * One deliberate deviation, called out here so it isn't mistaken for a typo:
 * the document gives the Ready Properties and Resale Properties tiles the same
 * description word for word. Two adjacent cards with identical copy read as a
 * bug on a live page, so the resale card describes resale. Both are editable.
 */
import { emptyImage } from "../types";
import type { MasterPageDef } from "../types";
import {
  text,
  area,
  link,
  image,
  eyebrow,
  heading,
  body,
  cardList,
} from "../fields";
import { SERVICE_FORM_ANCHOR } from "./property-management";

/**
 * What an interest option may be tagged with. The stored value routes the lead
 * — it lands on `enquiries.inferred_constraints.intent`, which is what the
 * admin filters and the routing rules read. Anything else is dropped on
 * submit rather than written through, so a typo in the editor can't invent an
 * intent the rest of the system has never heard of.
 */
export const CONSULTATION_INTENTS = ["buy", "sell", "rent", "invest"] as const;

export const PROPERTY_CONSULTATION_PAGE: MasterPageDef = {
  key: "consultation",
  label: "Property Consultation",
  path: "/services/consultation",
  description:
    "The property-consultation landing — the hero and its lead form, how we can help, what the consultation covers, who it is for, and the closing CTA.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Headline, opening line, standfirst and background image.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        text("lede", "Opening line", {
          max: 200,
          optional: true,
          help: "The single line directly under the headline, set larger than the standfirst.",
        }),
        body({ key: "sub", label: "Standfirst", max: 400 }),
        image(
          "image",
          "Background image",
          "Fills the hero behind the copy and the form, with a dark scrim over it so the text stays legible. Landscape, at least 2000px wide. Leave unset to keep the plain background.",
        ),
      ],
      defaults: {
        eyebrow: "Services · Property Consultation",
        title: "Property Consultation",
        title_emphasis: null,
        lede: "Better property decisions start with the right guidance.",
        sub: "Whether you are looking to buy, sell or invest, get professional property guidance based on your requirements, budget and objectives.",
        image: emptyImage("property consultation"),
      },
    },
    {
      key: "hero_form",
      label: "Lead form",
      description: "The enquiry card beside the headline, and its confirmation.",
      locked: true,
      dataNote:
        "Full name, phone, email and message are part of the form's behaviour and set in code. The interest options below are not — add, rename or reorder them here.",
      fields: [
        heading({ key: "form_title", label: "Form heading", max: 90 }),
        body({ key: "form_sub", label: "Form sub-heading", max: 300 }),
        text("interest_label", "Interest question", { max: 80 }),
        {
          key: "options",
          label: "Interest options",
          kind: "list",
          itemLabel: "option",
          max: 6,
          help: "The buttons under the interest question.",
          fields: [
            { key: "enabled", label: "Show this option", kind: "toggle" },
            text("label", "Label", { max: 40 }),
            text("intent", "Tag the lead as", {
              max: 20,
              // Written into the enquiry record and used to route it. Arabic
              // here corrupts CRM data in a column nobody re-reads.
              i18n: false,
              optional: true,
              help: `Used to route and filter the enquiry. One of: ${CONSULTATION_INTENTS.join(
                ", ",
              )}. Anything else is ignored.`,
            }),
          ],
        },
        text("submit_label", "Button label", { max: 60 }),
        area("note", "Small print", {
          max: 240,
          help: "Sits under the button.",
        }),
        text("success_title", "Confirmation heading", { max: 90 }),
        area("success_body", "Confirmation copy", { max: 400 }),
      ],
      defaults: {
        form_title: "Get a Free Property Consultation",
        form_sub:
          "Tell us what you are looking for and one of our property consultants will be in contact with you shortly.",
        interest_label: "I’m Interested In",
        options: [
          { enabled: true, label: "Buying", intent: "buy" },
          { enabled: true, label: "Selling", intent: "sell" },
          { enabled: true, label: "Investing", intent: "invest" },
        ],
        submit_label: "Request a Free Consultation",
        note: "By submitting you agree to be contacted by a Bazar advisor.",
        success_title: "Thank you — we have your details.",
        success_body:
          "One of our property consultants will be in contact with you shortly to talk through what you are looking for and the options available.",
      },
    },
    {
      key: "help",
      label: "How we can help",
      description:
        "“Property Guidance Built Around You” — the tiles that hand off into the catalogue.",
      fields: [
        eyebrow(),
        heading(),
        body({ key: "intro", label: "Intro", max: 500 }),
        cardList("items", "Tiles", {
          itemLabel: "tile",
          max: 8,
          withImage: true,
          withLink: true,
          help: "Laid out three to a row on desktop. A tile with no link renders as a plain card.",
        }),
      ],
      defaults: {
        eyebrow: "How we can help",
        heading: "Property Guidance Built Around You",
        intro:
          "Every property decision is different. We start by understanding what you are trying to achieve before recommending the opportunities that best match your requirements.",
        items: [
          {
            enabled: true,
            name: "Buying a Property",
            desc: "Compare locations, projects and properties based on your budget and lifestyle requirements.",
            cta: "Learn more",
            href: "/buy",
            image: emptyImage("buying a property"),
            img: "buying a property",
          },
          {
            enabled: true,
            name: "Selling a Property",
            desc: "Understand your property’s market position and the options available when bringing it to market.",
            cta: "Learn more",
            href: "/services/sell",
            image: emptyImage("selling a property"),
            img: "selling a property",
          },
          {
            enabled: true,
            name: "Off-Plan Properties",
            desc: "Compare new developments, payment plans, expected handover timelines and available unit types.",
            cta: "Learn more",
            href: "/off-plan",
            image: emptyImage("off-plan properties"),
            img: "off-plan properties",
          },
          {
            enabled: true,
            name: "Ready Properties",
            desc: "Explore completed, move-in-ready properties across Abu Dhabi’s established and new communities.",
            cta: "Learn more",
            href: "/buy/ready",
            image: emptyImage("ready properties"),
            img: "ready properties",
          },
          {
            enabled: true,
            name: "Resale Properties",
            desc: "Explore previously owned homes coming back to the market, with the title deed already issued.",
            cta: "Learn more",
            href: "/buy/resale",
            image: emptyImage("resale properties"),
            img: "resale properties",
          },
        ],
      },
    },
    {
      key: "covers",
      label: "What it covers",
      description:
        "“Make an Informed Property Decision” — the six things a consultation goes through.",
      fields: [
        eyebrow(),
        heading(),
        body({ key: "intro", label: "Intro", max: 400, optional: true }),
        cardList("items", "Cards", { itemLabel: "card", max: 9 }),
      ],
      defaults: {
        eyebrow: "What your consultation covers",
        heading: "Make an Informed Property Decision",
        intro: null,
        items: [
          {
            enabled: true,
            name: "Property Requirements",
            desc: "Understanding your preferred location, property type, budget and objectives.",
          },
          {
            enabled: true,
            name: "Market & Price Comparison",
            desc: "Comparing suitable properties and current market positioning.",
          },
          {
            enabled: true,
            name: "Location & Community Guidance",
            desc: "Understanding which Abu Dhabi areas best match your lifestyle or investment requirements.",
          },
          {
            enabled: true,
            name: "Project & Developer Comparison",
            desc: "Comparing available developments, property types and opportunities.",
          },
          {
            enabled: true,
            name: "Buying or Selling Process",
            desc: "Guidance through the main steps involved in the property transaction.",
          },
          {
            enabled: true,
            name: "Payment & Mortgage Considerations",
            desc: "Understanding payment plans, financing considerations and expected property costs.",
          },
        ],
      },
    },
    {
      key: "who",
      label: "Who it is for",
      description:
        "“Guidance for Every Property Journey” — the four audiences the service serves.",
      fields: [
        eyebrow(),
        heading(),
        body({ key: "intro", label: "Intro", max: 400, optional: true }),
        cardList("items", "Cards", { itemLabel: "card", max: 6 }),
      ],
      defaults: {
        eyebrow: "Who is it for?",
        heading: "Guidance for Every Property Journey",
        intro: null,
        items: [
          {
            enabled: true,
            name: "First-Time Buyers",
            desc: "Understand the market and buying process before making your first property decision.",
          },
          {
            enabled: true,
            name: "Homebuyers",
            desc: "Find a property that fits your lifestyle, family and location requirements.",
          },
          {
            enabled: true,
            name: "Property Investors",
            desc: "Compare opportunities based on your objectives and preferred investment strategy.",
          },
          {
            enabled: true,
            name: "Property Owners",
            desc: "Understand your options before selling or making your next property move.",
          },
        ],
      },
    },
    {
      key: "final_cta",
      label: "Closing CTA",
      description: "The navy band at the foot of the page.",
      fields: [
        eyebrow(),
        heading(),
        body({ max: 500 }),
        text("cta_label", "Button label", { max: 60 }),
        link("cta_href", "Button link", {
          help: `Defaults to the form at the top of this page (#${SERVICE_FORM_ANCHOR}). An internal path (/contact) or a full URL also works.`,
        }),
        image(
          "image",
          "Side image",
          "Sits beside the copy on desktop. Leave unset for a plain band.",
        ),
      ],
      defaults: {
        eyebrow: "Next step",
        heading: "Start with a Conversation",
        body: "Tell us what you are looking for, and our team will help you understand the options available and identify the next step.",
        cta_label: "Get a Free Property Consultation",
        cta_href: `#${SERVICE_FORM_ANCHOR}`,
        image: emptyImage("Abu Dhabi skyline"),
      },
    },
  ],
};
