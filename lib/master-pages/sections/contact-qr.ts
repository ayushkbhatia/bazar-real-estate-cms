import type { MasterPageDef } from "../types";
import { area, body, chipList, eyebrow, heading, link, text } from "../fields";

/**
 * /contact-us/qr — the scan destination.
 *
 * Where someone lands after scanning the printed QR code on a card, a window,
 * or an office wall. Almost every visitor arrives on a phone, seconds after
 * meeting us, so the page leads with tap-to-act (call, WhatsApp, email,
 * directions) and keeps the enquiry form underneath for anyone who'd rather
 * write than talk.
 *
 * Every `defaults` value is the copy the page renders today — the components
 * fall back to the same literals, so an un-edited page renders identically.
 */
export const CONTACT_QR_PAGE: MasterPageDef = {
  key: "contact-qr",
  label: "QR landing (contact)",
  path: "/contact-us/qr",
  description:
    "The page people land on after scanning the printed QR code — built for a phone, tap-to-call first.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description:
        "The welcome at the top of the page — acknowledges that the visitor just scanned a code.",
      locked: true,
      fields: [
        eyebrow(),
        heading({ label: "Headline" }),
        text("heading_emphasis", "Headline (italic tail)", {
          max: 60,
          optional: true,
          help: "Renders in italics after the headline. Leave blank for none.",
        }),
        body({ key: "body", label: "Sub-copy", max: 400 }),
      ],
      defaults: {
        eyebrow: "Scanned · Bazar Real Estate",
        heading: "Thanks for scanning.",
        heading_emphasis: "Let's talk.",
        body: "You're in the right place. Pick whichever way is easiest — call us, message us on WhatsApp, email, or send a short brief and an advisor will come back to you.",
      },
    },
    {
      key: "quick_actions",
      label: "Quick actions",
      description:
        "The tap-to-act rail: phone, WhatsApp, email, and the office address. Clear a value to hide that action.",
      locked: true,
      dataNote:
        "The WhatsApp button uses the advisor number configured in the site's WhatsApp settings, and hides itself when no number is set.",
      fields: [
        eyebrow(),
        text("phone_label", "Phone — label", { max: 60, optional: true }),
        text("phone_number", "Phone — number", { max: 40, optional: true }),
        text("phone_note", "Phone — note", { max: 80, optional: true }),
        text("whatsapp_label", "WhatsApp — label", { max: 60, optional: true }),
        text("whatsapp_value", "WhatsApp — line under the label", {
          max: 80,
          optional: true,
        }),
        text("whatsapp_message", "WhatsApp — prefilled message", {
          max: 200,
          optional: true,
          help: "Typed into the visitor's chat box before they hit send.",
        }),
        text("whatsapp_note", "WhatsApp — note", { max: 80, optional: true }),
        text("email_label", "Email — label", { max: 60, optional: true }),
        text("email_address", "Email — address", { max: 120, optional: true }),
        text("email_note", "Email — note", { max: 80, optional: true }),
        text("office_label", "Office — label", { max: 60, optional: true }),
        area("office_address", "Office — address", {
          max: 240,
          help: "One line per line break.",
        }),
        text("office_cta", "Office — link label", { max: 60, optional: true }),
        link("office_href", "Office — directions link"),
      ],
      defaults: {
        eyebrow: "Reach us",
        phone_label: "Call us",
        phone_number: "+971 2 632 2223",
        phone_note: "Mon–Sat 9am–7pm GST",
        whatsapp_label: "WhatsApp us",
        whatsapp_value: "Message an advisor",
        whatsapp_message: "Hi Bazar, I just scanned your QR code.",
        whatsapp_note: "Usually the fastest reply",
        email_label: "Email us",
        email_address: "info@bazarrealestate.ae",
        email_note: "We reply within 2 hours on business days",
        office_label: "Visit our office",
        office_address:
          "Sheikha Salama Building, Office 4\nZayed The First Street, Al Bateen\nAbu Dhabi, United Arab Emirates",
        office_cta: "Get directions",
        office_href:
          "https://www.google.com/maps/dir/?api=1&destination=24.468113844266917,54.339882834551275",
      },
    },
    {
      key: "enquiry_form",
      label: "Enquiry form",
      description:
        "Heading and blurb above the short enquiry form, for visitors who'd rather write than call.",
      dataNote:
        "The form's own fields and its confirmation message are fixed in code. Submissions arrive in Enquiries, tagged as coming from the contact page.",
      fields: [
        eyebrow(),
        heading({ label: "Heading" }),
        body({ key: "body", label: "Blurb", max: 300 }),
      ],
      defaults: {
        eyebrow: "Or send a brief",
        heading: "Tell us what you're after.",
        body: "A few lines is plenty — area, budget, timeline. An advisor will come back to you shortly.",
      },
    },
    {
      key: "explore",
      label: "Explore links",
      description:
        "A short row of tappable links to the main parts of the site, for anyone browsing before they get in touch.",
      fields: [
        eyebrow(),
        heading({ label: "Heading" }),
        chipList("links", "Links", 6),
      ],
      defaults: {
        eyebrow: "While you're here",
        heading: "Have a look around.",
        links: [
          { label: "Properties for sale", href: "/buy" },
          { label: "Properties for rent", href: "/rent" },
          { label: "New projects", href: "/off-plan" },
        ],
      },
    },
  ],
};
