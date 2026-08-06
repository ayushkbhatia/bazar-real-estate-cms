import type { ListFieldDef, MasterPageDef } from "../types";
import {
  area,
  body,
  chipList,
  eyebrow,
  heading,
  image,
  link,
  text,
} from "../fields";

/**
 * /contact-qr — the scan destination, built as a digital business card.
 *
 * Where someone lands after scanning the printed QR code on a card, a window,
 * or an office wall. Almost every visitor arrives on a phone, seconds after
 * meeting us, so the page is one card: logo, a single "Add to Contacts" button
 * that downloads a vCard, then tappable rows for each way of reaching us.
 *
 * Every label exists twice — plain and `_ar`. The card carries its own EN/AR
 * toggle rather than routing to a translated page: the numbers, the address
 * and the links are identical in both, only the labels change, so a second
 * route would duplicate the whole page to translate eight words. Leaving an
 * `_ar` field blank falls back to the English label rather than rendering a
 * hole.
 *
 * Every `defaults` value is the copy the page renders today — the components
 * fall back to the same literals, so an un-edited page renders identically.
 */

/**
 * The follow row. `network` drives which glyph is drawn (matched loosely on
 * the name, so "Instagram" and "instagram" both land); anything unrecognised
 * gets a generic globe rather than disappearing.
 */
const socialList = (max = 8): ListFieldDef => ({
  key: "socials",
  label: "Social links",
  kind: "list",
  itemLabel: "link",
  max,
  fields: [
    text("network", "Network", {
      max: 40,
      help: "Instagram, Facebook, TikTok, YouTube, LinkedIn or X — picks the icon.",
    }),
    link("href", "Profile URL"),
  ],
});

export const CONTACT_QR_PAGE: MasterPageDef = {
  key: "contact-qr",
  label: "QR landing (contact card)",
  path: "/contact-qr",
  description:
    "The page people land on after scanning the printed QR code — a digital business card, built for a phone.",
  sections: [
    {
      key: "card",
      label: "Card head",
      description:
        "The top of the card: logo, tagline, and the button that saves Bazar to the visitor's phone.",
      locked: true,
      dataNote:
        "The Add to Contacts button builds its .vcf file from the numbers, email, website and address in Contact details below.",
      fields: [
        image(
          "logo",
          "Logo",
          "Shown at the top of the card. Falls back to the Bazar wordmark when empty.",
        ),
        text("name", "Company name", {
          max: 80,
          help: "The card's heading, and the name saved into the visitor's contacts.",
        }),
        text("tagline", "Tagline", { max: 120, optional: true }),
        text("tagline_ar", "Tagline (Arabic)", { max: 160, optional: true }),
        text("save_label", "Save button", { max: 40 }),
        text("save_label_ar", "Save button (Arabic)", {
          max: 60,
          optional: true,
        }),
      ],
      defaults: {
        logo: { media_id: null, alt: null, label: null },
        name: "Bazar Real Estate",
        tagline: "Award-winning real estate agency in the UAE",
        tagline_ar: "شركة عقارية حائزة على العديد من الجوائز في الإمارات",
        save_label: "Add to Contacts",
        save_label_ar: "إضافة إلى جهات الاتصال",
      },
    },
    {
      key: "details",
      label: "Contact details",
      description:
        "The tappable rows: mobile, landline, WhatsApp, email, website and office. Clear a value to hide that row.",
      locked: true,
      fields: [
        text("mobile_label", "Mobile — label", { max: 60, optional: true }),
        text("mobile_label_ar", "Mobile — label (Arabic)", {
          max: 60,
          optional: true,
        }),
        text("mobile_number", "Mobile — number", { max: 40, optional: true }),

        text("landline_label", "Landline — label", { max: 60, optional: true }),
        text("landline_label_ar", "Landline — label (Arabic)", {
          max: 60,
          optional: true,
        }),
        text("landline_number", "Landline — number", {
          max: 40,
          optional: true,
        }),

        text("whatsapp_label", "WhatsApp — label", { max: 60, optional: true }),
        text("whatsapp_label_ar", "WhatsApp — label (Arabic)", {
          max: 60,
          optional: true,
        }),
        text("whatsapp_number", "WhatsApp — number", {
          max: 40,
          optional: true,
          help: "Leave blank to hide the row — the mobile number above already reaches WhatsApp.",
        }),
        text("whatsapp_message", "WhatsApp — prefilled message", {
          max: 200,
          optional: true,
        }),

        text("email_label", "Email — label", { max: 60, optional: true }),
        text("email_label_ar", "Email — label (Arabic)", {
          max: 60,
          optional: true,
        }),
        text("email_address", "Email — address", { max: 120, optional: true }),

        text("website_label", "Website — label", { max: 60, optional: true }),
        text("website_label_ar", "Website — label (Arabic)", {
          max: 60,
          optional: true,
        }),
        text("website_display", "Website — shown as", {
          max: 120,
          optional: true,
        }),
        link("website_href", "Website — link"),

        text("office_label", "Office — label", { max: 60, optional: true }),
        text("office_label_ar", "Office — label (Arabic)", {
          max: 60,
          optional: true,
        }),
        area("office_address", "Office — address", {
          max: 240,
          help: "One line per line break.",
        }),
        area("office_address_ar", "Office — address (Arabic)", { max: 300 }),
        text("office_city", "Office — city", {
          max: 60,
          optional: true,
          help: "Used by the saved contact card, not shown on the page.",
        }),
        text("office_country", "Office — country", { max: 60, optional: true }),
      ],
      defaults: {
        mobile_label: "Mobile",
        mobile_label_ar: "الهاتف",
        mobile_number: "+971 50 691 1103",
        landline_label: "Office landline",
        landline_label_ar: "الهاتف الأرضي",
        landline_number: "+971 2 632 2223",
        whatsapp_label: "WhatsApp",
        whatsapp_label_ar: "واتساب",
        whatsapp_number: null,
        whatsapp_message: "Hi Bazar, I just scanned your QR code.",
        email_label: "Email",
        email_label_ar: "البريد الإلكتروني",
        email_address: "info@bazarrealestate.ae",
        website_label: "Website",
        website_label_ar: "الموقع الإلكتروني",
        website_display: "bazarrealestate.ae",
        website_href: "https://www.bazarrealestate.ae",
        office_label: "Office",
        office_label_ar: "المكتب",
        office_address:
          "Sheikha Salama Building, Office 4, Zayed The First St, Al Bateen, Abu Dhabi",
        office_address_ar:
          "مبنى الشيخة سلامة، مكتب ٤، شارع زايد الأول، البطين، أبوظبي",
        office_city: "Abu Dhabi",
        office_country: "United Arab Emirates",
      },
    },
    {
      key: "follow",
      label: "Follow & footer",
      description:
        "The social icons, the map link at the foot of the card, and the line of small print under it.",
      fields: [
        text("follow_label", "Follow — label", { max: 40, optional: true }),
        text("follow_label_ar", "Follow — label (Arabic)", {
          max: 40,
          optional: true,
        }),
        socialList(),
        text("map_label", "Map button", { max: 60, optional: true }),
        text("map_label_ar", "Map button (Arabic)", { max: 60, optional: true }),
        link("map_href", "Map link"),
        text("footer_note", "Small print", { max: 120, optional: true }),
        text("footer_note_ar", "Small print (Arabic)", {
          max: 160,
          optional: true,
        }),
      ],
      defaults: {
        follow_label: "Follow",
        follow_label_ar: "تابعنا",
        socials: [
          { network: "Instagram", href: "https://www.instagram.com/bazarrealestate" },
          { network: "Facebook", href: "https://www.facebook.com/bazarrealestateae" },
          { network: "TikTok", href: "https://www.tiktok.com/@bazarrealestate" },
          { network: "YouTube", href: "https://www.youtube.com/@bazarrealestateae" },
          {
            network: "LinkedIn",
            href: "https://www.linkedin.com/company/bazarrealestate",
          },
        ],
        map_label: "Our Office Location",
        map_label_ar: "موقع مكتبنا",
        map_href:
          "https://www.google.com/maps/dir/?api=1&destination=24.468113844266917,54.339882834551275",
        footer_note: "Established 2005 · Regulated by ADREC & DLD",
        footer_note_ar: "تأسست عام 2005 · خاضعة لإشراف ADREC وDLD",
      },
    },
    {
      key: "enquiry_form",
      label: "Enquiry form",
      description:
        "Heading and blurb above the short enquiry form, for visitors who'd rather write than call.",
      // Off by default: the card is the page, and a form under it competes
      // with the one action this page exists for. The section keeps its copy
      // so it can be switched back on without retyping anything.
      defaultEnabled: false,
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
      defaultEnabled: false,
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
