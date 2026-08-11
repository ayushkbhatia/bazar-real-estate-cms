/**
 * /contact — the enquiry page.
 *
 * The contact-details rail is the point of this page and the thing a client is
 * most likely to change, so the phone numbers, email address and office address
 * are all plain editable fields. They are stored as separate strings rather
 * than as the rendered markup: the page builds the `tel:` and `mailto:` links
 * from the numbers itself (stripping spaces), and the address is one line per
 * line in a textarea, rendered with line breaks. The icons (phone, envelope,
 * pin, clock) stay in code — a stored value can't carry a component.
 *
 * Opening hours are a list, one row per day, holding 24-hour times rather than
 * a sentence: the page reads them back to say whether the office is open right
 * now and when it next opens or closes. Free text still renders verbatim, it
 * just drops out of that calculation — see _components/hours.ts.
 *
 * The "How can we help?" tiles ARE a list field: the editor genuinely owns the
 * whole set of nine. Each tile names its icon by an allowlisted keyword
 * (`home`, `building`, …) which the page maps to a Lucide component; an unknown
 * or blank name falls back to an icon keyed off the tile's link, then to a
 * generic one, so a tile can never render iconless.
 *
 * Every `defaults` value is the copy the page rendered before it became
 * editable, so an un-edited page renders byte-identically to before.
 */
import type { MasterPageDef } from "../types";
import {
  text,
  area,
  link,
  image,
  toggle,
  eyebrow,
  heading,
  body,
} from "../fields";

export const CONTACT_PAGE: MasterPageDef = {
  key: "contact",
  label: "Contact",
  path: "/contact",
  description:
    "The contact page — office details, the enquiry form, and the HQ map.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description:
        "Eyebrow, headline and standfirst at the top of the page, with the photo beside them.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        body({ key: "subtitle", label: "Sub-headline" }),
        image(
          "photo",
          "Hero image",
          "Shown beside the headline at 4:3. Left empty, the striped placeholder shows instead.",
        ),
      ],
      defaults: {
        eyebrow: "Contact",
        title: "Let's talk",
        title_emphasis: "property.",
        subtitle:
          "Get in touch with Bazar Real Estate for buying, selling, renting, listing, or investment enquiries across Abu Dhabi and the UAE.",
        photo: {
          media_id: null,
          alt: null,
          label: "bazar office · al bateen · abu dhabi",
        },
      },
    },
    {
      key: "contact_details",
      label: "Contact details",
      description:
        "Phone numbers, email address, the office address and the opening-hours panel.",
      locked: true,
      dataNote:
        "The phone and email links are built from the values below — write the number the way it should read on the page and the tap-to-call link follows. The open/closed line above the hours is worked out from the times, on Abu Dhabi time.",
      fields: [
        text("phone_label", "Phone · heading", { max: 80 }),
        text("phone_1", "Phone · first number", { max: 40 }),
        text("phone_2", "Phone · second number", { max: 40, optional: true }),
        text("phone_note", "Phone · small print", {
          max: 120,
          optional: true,
          help: "Small print under the numbers. The opening hours have their own panel below — don't repeat them here.",
        }),
        text("email_label", "Email · heading", { max: 80 }),
        text("email", "Email address", { max: 160 }),
        text("email_note", "Email · small print", { max: 120, optional: true }),
        text("office_label", "Office · heading", { max: 80 }),
        area("address", "Office address", {
          max: 300,
          optional: false,
          help: "One line per line — each becomes a new line on the page.",
        }),
        text("office_note", "Office · small print", {
          max: 120,
          optional: true,
        }),
        text("hours_label", "Opening hours · heading", { max: 80 }),
        {
          key: "hours",
          label: "Opening hours",
          kind: "list",
          itemLabel: "day",
          max: 7,
          help: "One row per day, in the order they should read. Delete every row to hide the panel.",
          fields: [
            text("day", "Day", { max: 20 }),
            text("open", "Opens", {
              max: 40,
              optional: true,
              help: "24-hour clock — 09:00 renders as 9 AM. Anything else (“By appointment”) renders as written and is left out of the open/closed line.",
            }),
            text("close", "Closes", { max: 40, optional: true }),
            toggle(
              "open_day",
              "Open this day",
              "Switch off for a day the office is shut — the row then reads “Closed”.",
            ),
          ],
        },
      ],
      defaults: {
        phone_label: "Call us / message us",
        phone_1: "+971 2 632 2223",
        phone_2: "+971 50 691 1103",
        // Was "Mon–Sat 9am–7pm GST" — the hours panel below states this now,
        // and two copies of the office hours can disagree.
        phone_note: null,
        email_label: "Email us",
        email: "info@bazarrealestate.ae",
        email_note: "We reply within 2 hours on business days",
        office_label: "Visit our office",
        address:
          "Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates",
        office_note: null,
        hours_label: "Opening hours",
        // The hours the live page already quotes (Monday–Sunday, 9AM–7PM GST),
        // one row per day so the panel can say what today's are.
        hours: [
          { day: "Monday", open: "09:00", close: "19:00", open_day: true },
          { day: "Tuesday", open: "09:00", close: "19:00", open_day: true },
          { day: "Wednesday", open: "09:00", close: "19:00", open_day: true },
          { day: "Thursday", open: "09:00", close: "19:00", open_day: true },
          { day: "Friday", open: "09:00", close: "19:00", open_day: true },
          { day: "Saturday", open: "09:00", close: "19:00", open_day: true },
          { day: "Sunday", open: "09:00", close: "19:00", open_day: true },
        ],
      },
    },
    {
      key: "enquiry_form",
      label: "Enquiry form",
      description: "Heading and intro above the enquiry form card.",
      dataNote:
        "The form's own fields, labels and confirmation message aren't editable here. The WhatsApp link only appears when an advisor number is configured.",
      fields: [
        heading({ key: "form_title", label: "Form title" }),
        area("form_sub", "Form sub-copy", { max: 300 }),
        text("whatsapp_label", "WhatsApp link label", {
          max: 60,
          optional: true,
        }),
      ],
      defaults: {
        form_title: "Send us an enquiry",
        form_sub:
          "Tell us what you're looking for, and our team will get back to you shortly.",
        whatsapp_label: "WhatsApp us instead",
      },
    },
    {
      key: "help",
      label: "How can we help?",
      description: "Grid of tiles pointing each kind of enquiry at the right page.",
      fields: [
        eyebrow(),
        heading(),
        body({ key: "sub", label: "Sub-heading", max: 300 }),
        {
          key: "items",
          label: "Tiles",
          kind: "list",
          itemLabel: "tile",
          max: 12,
          help: "The whole grid — add, reorder or remove tiles here.",
          fields: [
            text("label", "Label", { max: 80 }),
            link("href", "Link"),
            text("icon", "Icon", {
              max: 20,
              optional: true,
              help: "One of: home, building, tag, upload, layers, link, sliders, file, user. Anything else falls back to a generic icon.",
            }),
          ],
        },
      ],
      defaults: {
        eyebrow: "How can we help?",
        heading: "Choose the service that matches your enquiry.",
        sub: "We'll connect you with the right member of our team.",
        items: [
          { label: "Buy a Property", href: "/buy", icon: "home" },
          { label: "Rent a Property", href: "/rent", icon: "building" },
          { label: "Sell Your Property", href: "/services/sell", icon: "tag" },
          { label: "List Your Property", href: "/services/sell", icon: "upload" },
          { label: "Explore New Projects", href: "/off-plan", icon: "layers" },
          { label: "Our Partners", href: "/developers", icon: "link" },
          { label: "Our Services", href: "/services", icon: "sliders" },
          { label: "Insights", href: "/insights", icon: "file" },
          { label: "About Us", href: "/about", icon: "user" },
        ],
      },
    },
    {
      key: "hq_map",
      label: "HQ map",
      description: "Full-width map of the Al Bateen head office.",
      dataNote:
        "The office coordinates, the map heading and the 'Get directions' link are set in code — this section switches the map on or off and moves it up or down the page.",
      fields: [],
      defaults: {},
    },
  ],
};
