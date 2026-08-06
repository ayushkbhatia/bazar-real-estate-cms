import type { MasterPageDef } from "../types";
import { area, body, ctaPair, eyebrow, heading, link, text, toggle } from "../fields";

/**
 * /qr — the scan-to-contact display page.
 *
 * A print/screen surface rather than a marketing page: an office screen, a
 * window sticker, or the back of a card. Everything on it is copy, so every
 * word is editable — but the QR itself is generated server-side from the
 * `url` field, which is deliberately NOT derived from the request origin.
 * A code printed on a card has to keep resolving to the same address whatever
 * environment rendered it, so the destination is content, not configuration.
 *
 * As with the other master pages, every `defaults` value below is the copy the
 * page renders today, character for character.
 */
export const QR_PAGE: MasterPageDef = {
  key: "qr",
  label: "QR",
  path: "/qr",
  description:
    "The scan-to-contact display page — a large QR code for screens, windows and print.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Eyebrow, headline and standfirst above the code.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        body({ key: "subtitle", label: "Sub-headline" }),
      ],
      defaults: {
        eyebrow: "Scan to connect",
        // The rendered headline italicises its last word; the page owns that
        // treatment, so it is stored here as one plain string.
        title: "Point your camera here.",
        subtitle:
          "Scan the code to reach Bazar Real Estate — buying, selling, renting, listing, or investment enquiries across Abu Dhabi and the UAE.",
      },
    },
    {
      key: "qr_code",
      label: "QR code",
      description:
        "The code itself, the address it opens, and the line telling people how to scan it.",
      locked: true,
      dataNote:
        "The image is generated from the address below every time the page renders — there is nothing to upload. Change the address and every code printed from the old one stops pointing here.",
      fields: [
        link("url", "Destination address", {
          optional: false,
          max: 500,
          help: "Where the code takes people. Use a full https:// address — printed codes are read by phone cameras, which can't resolve an internal path.",
        }),
        heading({ optional: true }),
        text("caption", "Caption", { max: 120, optional: true }),
        area("instruction", "How to scan", { max: 240 }),
        toggle(
          "show_url",
          "Print the address under the code",
          "Leave this on so anyone whose camera won't focus can type the address instead.",
        ),
      ],
      defaults: {
        url: "https://www.bazarrealestate.ae/contact-qr",
        heading: "Talk to Bazar Real Estate",
        caption: "Opens our contact page.",
        instruction:
          "Open the camera on your phone, hold it over the code, and tap the link that appears. No app needed.",
        show_url: true,
      },
    },
    {
      key: "contact_details",
      label: "Contact details",
      description:
        "Phone, email and office address, for anyone who would rather not scan.",
      fields: [
        eyebrow(),
        heading({ optional: true }),
        text("phone_label", "Phone heading", { max: 60, optional: true }),
        text("phone_primary", "Phone number", { max: 40 }),
        text("phone_secondary", "Second phone number", {
          max: 40,
          optional: true,
        }),
        text("phone_note", "Phone note", { max: 80, optional: true }),
        text("email_label", "Email heading", { max: 60, optional: true }),
        text("email", "Email address", { max: 120 }),
        text("email_note", "Email note", { max: 80, optional: true }),
        text("address_label", "Office heading", { max: 60, optional: true }),
        area("address", "Office address", {
          max: 300,
          help: "One line per line of the address.",
        }),
      ],
      defaults: {
        eyebrow: "Or reach us directly",
        heading: "Bazar Real Estate, Abu Dhabi.",
        phone_label: "Call us / message us",
        phone_primary: "+971 2 632 2223",
        phone_secondary: "+971 50 691 1103",
        phone_note: "Mon–Sat 9am–7pm GST",
        email_label: "Email us",
        email: "info@bazarrealestate.ae",
        email_note: "We reply within 2 hours on business days",
        address_label: "Visit our office",
        address:
          "Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates",
      },
    },
    {
      key: "cta",
      label: "Closing band",
      description:
        "A last prompt at the foot of the page, with up to two links. Hidden on print.",
      fields: [
        eyebrow(),
        heading(),
        body(),
        ...ctaPair("Primary link label"),
        text("cta_2_label", "Secondary link label", { max: 60, optional: true }),
        link("cta_2_href", "Secondary link"),
      ],
      defaults: {
        eyebrow: "No phone to hand?",
        heading: "Send us an enquiry instead.",
        body: "Tell us what you're looking for and our team will get back to you shortly.",
        cta_label: "Contact us",
        cta_href: "/contact",
        cta_2_label: "Browse properties",
        cta_2_href: "/buy",
      },
    },
  ],
};
