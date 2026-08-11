/**
 * /services/manage — the Property Management landing.
 *
 * Replaces the seed-driven `ServicePage` this route used to render. That
 * template took its copy from `lib/seeds/services.ts`, which meant a wording
 * change needed a deploy, and it had no lead form at all — the only call to
 * action was a link to /contact.
 *
 * The structure below follows the client's content document section for
 * section: hero + lead form, the six support cards, the four long-term care
 * cards, the three-step "how it works", and the closing CTA. Every string in
 * `defaults` is the document's copy verbatim, so the page renders the approved
 * wording before anyone opens the editor.
 *
 * The form's *inputs* stay in code — name, phone, email, property location,
 * property type, message. Those are behaviour (validation, routing, what lands
 * on the enquiry row), not copy. Its labels, its heading and its button are
 * fields, which is where the wording actually changes.
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

/**
 * Anchor the in-page CTAs jump to. The hero is `locked`, so the form is always
 * the first thing on the page and the link can never point above the fold.
 */
export const SERVICE_FORM_ANCHOR = "lead-form";

export const PROPERTY_MANAGEMENT_PAGE: MasterPageDef = {
  key: "manage",
  label: "Property Management",
  path: "/services/manage",
  description:
    "The property-management landing — the hero and its lead form, the support and long-term care cards, how it works, and the closing CTA.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Headline, standfirst and the background image behind them.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        body({ key: "sub", label: "Standfirst", max: 400 }),
        image(
          "image",
          "Background image",
          "Fills the hero behind the copy and the form, with a dark scrim over it so the text stays legible. Landscape, at least 2000px wide. Leave unset to keep the plain background.",
        ),
      ],
      defaults: {
        eyebrow: "Services · Property Management",
        title: "Property Management in Abu Dhabi",
        title_emphasis: null,
        sub: "Professional property management focused on protecting your property, supporting tenants and ensuring efficient day-to-day operations.",
        image: emptyImage("property management"),
      },
    },
    {
      key: "hero_form",
      label: "Lead form",
      description: "The enquiry card beside the headline, and its confirmation.",
      locked: true,
      dataNote:
        "The fields themselves — full name, phone, email, property location, property type and message — are part of the form's behaviour and set in code. Everything an owner reads around them is editable here.",
      fields: [
        heading({ key: "form_title", label: "Form heading", max: 90 }),
        body({ key: "form_sub", label: "Form sub-heading", max: 300 }),
        text("submit_label", "Button label", { max: 60 }),
        area("note", "Small print", {
          max: 240,
          help: "Sits under the button.",
        }),
        text("success_title", "Confirmation heading", { max: 90 }),
        area("success_body", "Confirmation copy", { max: 400 }),
      ],
      defaults: {
        form_title: "Let Us Manage Your Property",
        form_sub:
          "Tell us about your property and one of our property consultants will be in contact with you shortly.",
        submit_label: "Request Property Management Support",
        note: "By submitting you agree to be contacted by a Bazar advisor.",
        success_title: "Thank you — we have your details.",
        success_body:
          "One of our property consultants will be in contact with you shortly to talk through your property and the support you need.",
      },
    },
    {
      key: "support",
      label: "Management support",
      description:
        "“Your Property, Professionally Managed” — the six cards covering what the service includes.",
      fields: [
        eyebrow(),
        heading(),
        body({ key: "intro", label: "Intro", max: 400 }),
        cardList("items", "Cards", {
          itemLabel: "card",
          max: 9,
          withImage: true,
          help: "Laid out three to a row on desktop.",
        }),
      ],
      defaults: {
        eyebrow: "Complete property management support",
        heading: "Your Property, Professionally Managed",
        intro:
          "Dedicated property management to help landlords protect their property, manage tenants and handle ongoing tenancy requirements efficiently.",
        items: [
          {
            enabled: true,
            name: "Tenant Management",
            desc: "Professional tenant communication and support.",
            image: emptyImage("tenant management"),
            img: "tenant management",
          },
          {
            enabled: true,
            name: "Rent Collection",
            desc: "Rental payment management and tracking.",
            image: emptyImage("rent collection"),
            img: "rent collection",
          },
          {
            enabled: true,
            name: "Lease Administration",
            desc: "Support with tenancy registration, renewals and documentation.",
            image: emptyImage("lease administration"),
            img: "lease administration",
          },
          {
            enabled: true,
            name: "Maintenance Coordination",
            desc: "Efficient coordination of property maintenance and repairs.",
            image: emptyImage("maintenance coordination"),
            img: "maintenance coordination",
          },
          {
            enabled: true,
            name: "Property Inspections",
            desc: "Regular oversight of property condition and maintenance needs.",
            image: emptyImage("property inspections"),
            img: "property inspections",
          },
          {
            enabled: true,
            name: "Move-In & Move-Out Support",
            desc: "Coordination of handovers, access and property documentation.",
            image: emptyImage("move-in and move-out"),
            img: "move-in and move-out",
          },
        ],
      },
    },
    {
      key: "care",
      label: "Long-term care",
      description:
        "“Protecting Your Property for the Long Term” — the four-up band under the support cards.",
      fields: [
        eyebrow(),
        heading(),
        body({ key: "intro", label: "Intro", max: 400 }),
        cardList("items", "Cards", { itemLabel: "card", max: 6 }),
      ],
      defaults: {
        eyebrow: "More than day-to-day management",
        heading: "Protecting Your Property for the Long Term",
        intro:
          "Professional management helps maintain your property, support tenants and keep everything organised.",
        items: [
          {
            enabled: true,
            name: "Property Care",
            desc: "Ongoing attention to the condition and maintenance of your property.",
          },
          {
            enabled: true,
            name: "Tenant Support",
            desc: "A professional point of contact throughout the tenancy.",
          },
          {
            enabled: true,
            name: "Clear Administration",
            desc: "Organised management of property, tenancy and payment records.",
          },
          {
            enabled: true,
            name: "Dedicated Support",
            desc: "One team supporting the ongoing requirements of your property.",
          },
        ],
      },
    },
    {
      key: "how_it_works",
      label: "How it works",
      description: "The numbered three-step flow.",
      fields: [
        eyebrow(),
        heading(),
        body({ key: "intro", label: "Intro", max: 400, optional: true }),
        {
          key: "steps",
          label: "Steps",
          kind: "list",
          itemLabel: "step",
          max: 6,
          help: "Numbered automatically, in the order listed here.",
          fields: [
            text("title", "Step", { max: 120 }),
            area("desc", "Description", { max: 300, optional: false }),
          ],
        },
      ],
      defaults: {
        eyebrow: "How it works",
        heading: "Simple Property Management from Start to Finish",
        intro: null,
        steps: [
          {
            title: "Share Your Property Details",
            desc: "Tell us about your property and management requirements.",
          },
          {
            title: "Property Review",
            desc: "We review the property, tenancy status and required services.",
          },
          {
            title: "Management Begins",
            desc: "Once agreed, our team manages the day-to-day requirements of your property.",
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
        heading: "Leave the Management to Us",
        body: "Spend less time managing the day-to-day responsibilities of your property and more time focusing on your investment. Speak with our team about professional property management in Abu Dhabi.",
        cta_label: "Request a Free Consultation",
        cta_href: `#${SERVICE_FORM_ANCHOR}`,
        image: emptyImage("Abu Dhabi skyline"),
      },
    },
  ],
};
