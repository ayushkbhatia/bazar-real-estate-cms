/**
 * /services/sell — "List your property", the owner lead-capture landing.
 *
 * This page carried more hardcoded copy than any other marketing route: the
 * pitch, the three trust points, the whole two-step form, the confirmation
 * screen an owner sees after submitting, the pricing band and the FAQ. The FAQ
 * in particular quotes Abu Dhabi fees, procedures and notice periods (the 2%
 * transfer fee, the NOC range, the twelve-month vacancy notice, Tawtheeq,
 * ADREC, DMT) which the design handoff flags for compliance sign-off — a
 * correction to any of them used to need a deploy. They are all fields now.
 *
 * Two things stay in code and are called out with `dataNote`:
 *  - the form's own inputs, their validation and the routing that picks the
 *    advisor. Those are behaviour, not copy;
 *  - the hero stat rail and the transactions sparkline, which count live rows
 *    rather than repeat a number someone typed. The stat list below overrides
 *    the live rail when an editor fills it in, and is empty by default.
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
  faqList,
  statList,
} from "../fields";

/**
 * Placeholders an editor may use in the confirmation copy. They are documented
 * on each field's `help` and filled in by the form at render time — the advisor
 * and the call window are only known after the lead has been routed, so they
 * cannot be typed into the stored string.
 */
export const SELL_ADVISOR_TOKEN = "{advisor}";
export const SELL_WHEN_TOKEN = "{when}";

export const SELL_PAGE: MasterPageDef = {
  key: "sell",
  label: "List your property",
  path: "/services/sell",
  description:
    "The owner landing page — the pitch, the two-step enquiry form, the pricing band and the FAQ.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "The pitch, the trust points and the stat rail beside the form.",
      locked: true,
      dataNote:
        "Leave the stat list empty to keep the live rail, which counts published listings, areas covered and active advisors. Filling it in replaces those with your own figures.",
      fields: [
        eyebrow(),
        heading({ key: "title", label: "Headline" }),
        text("title_emphasis", "Emphasised tail", {
          max: 60,
          optional: true,
          help: "Rendered in italic at the end of the headline.",
        }),
        body({ key: "sub", label: "Sub-headline", max: 400 }),
        image(
          "image",
          "Background image",
          "Fills the whole hero behind the pitch and the form, with a dark scrim over it so the text stays legible. Landscape, at least 2000px wide. Leave unset to keep the plain background.",
        ),
        {
          key: "points",
          label: "Trust points",
          kind: "list",
          itemLabel: "point",
          max: 6,
          help: "The ticked list under the sub-headline.",
          fields: [
            toggle("enabled", "Show this point"),
            text("title", "Title", { max: 80 }),
            area("detail", "Detail", { max: 200 }),
          ],
        },
        statList(4),
      ],
      defaults: {
        eyebrow: "Owners · Abu Dhabi & Al Ain",
        // Rendered across two lines, with the emphasis on the tail. Stored as
        // one string per line break; the page owns the treatment.
        title: "Sell or rent out,\nwith one advisor",
        title_emphasis: "accountable.",
        sub: "Tell us about the property. We match you with the senior Bazar advisor who covers your community — the same person runs it from valuation through to transfer.",
        // Unset by default: the hero keeps its current plain treatment until
        // someone picks a photo, so the page doesn't change on deploy.
        image: { media_id: null, alt: null, label: null },
        points: [
          {
            enabled: true,
            title: "ADREC-licensed advisors",
            detail: "Every advisor registered, vetted and named on your file",
          },
          {
            enabled: true,
            title: "No upfront fees",
            detail:
              "Photography, listing and portal spend are on us. Commission on completion only",
          },
          {
            enabled: true,
            title: "One point of contact",
            detail: "No handoffs between a lister, a viewer and a closer",
          },
        ],
        // Empty on purpose — the rail counts live rows. See the dataNote.
        stats: [],
      },
    },
    {
      key: "form",
      label: "Enquiry form",
      description: "The two-step form card: step labels, buttons and reassurance copy.",
      locked: true,
      dataNote:
        "The form's own questions, their options and the advisor routing aren't editable here — only the copy around them.",
      fields: [
        text("step_1_label", "Step 1 · tab label", { max: 60 }),
        text("step_2_label", "Step 2 · tab label", { max: 60 }),
        text("continue_label", "Step 1 · button", { max: 60 }),
        area("reassurance", "Step 1 · small print", { max: 240 }),
        text("details_title", "Step 2 · heading", { max: 120 }),
        area("details_sub", "Step 2 · sub-copy", { max: 300 }),
        area("consent_label", "Consent checkbox", { max: 300, optional: false }),
        text("submit_label", "Step 2 · submit button", { max: 60 }),
        text("submit_pending_label", "Step 2 · button while sending", { max: 60 }),
        text("back_label", "Step 2 · back button", { max: 60 }),
        text("edit_label", "Step 2 · edit-summary button", { max: 60 }),
      ],
      defaults: {
        step_1_label: "Your property",
        step_2_label: "Your details",
        continue_label: "Continue",
        reassurance:
          "Takes about two minutes. Nothing is published without your written go-ahead.",
        details_title: "Where should the advisor reach you?",
        details_sub:
          "Your details go to one advisor only. We don't sell them on, and you won't be added to a mailing list.",
        consent_label:
          "I agree that Bazar Real Estate may contact me about this property by phone, WhatsApp and email.",
        submit_label: "Match me with an advisor",
        submit_pending_label: "Matching…",
        back_label: "Back",
        edit_label: "Edit",
      },
    },
    {
      key: "confirmation",
      label: "Form confirmation",
      description:
        "What an owner sees after submitting — the match, the advisor card and the timeline.",
      locked: true,
      dataNote:
        "The advisor's name, photo initials, licence and phone come from the matched staff record. The reference number is generated per enquiry.",
      fields: [
        text("reference_label", "Reference · prefix", {
          max: 60,
          help: "The enquiry reference is appended to this.",
        }),
        text("heading_matched", "Heading · advisor matched", {
          max: 160,
          help: `Use ${SELL_ADVISOR_TOKEN} for the advisor's first name and ${SELL_WHEN_TOKEN} for the chosen call window.`,
        }),
        text("heading_desk", "Heading · no advisor matched", {
          max: 160,
          help: `Shown when no advisor covers the area. Use ${SELL_WHEN_TOKEN} for the chosen call window.`,
        }),
        area("summary_matched", "Summary tail · advisor matched", { max: 240 }),
        area("summary_desk", "Summary tail · no advisor matched", { max: 240 }),
        text("desk_name", "Desk fallback · name", { max: 80 }),
        text("desk_role", "Desk fallback · role line", { max: 120 }),
        text("desk_initials", "Desk fallback · initials", { max: 4 }),
        text("call_label", "Call button", { max: 60 }),
        text("steps_label", "Timeline heading", { max: 80 }),
        {
          key: "steps",
          label: "Timeline",
          kind: "list",
          itemLabel: "step",
          max: 6,
          help: `What happens next, in order. Use ${SELL_ADVISOR_TOKEN} for the advisor's first name.`,
          fields: [
            toggle("enabled", "Show this step"),
            text("when", "When", { max: 60 }),
            area("what", "What happens", { max: 300 }),
          ],
        },
        text("another_label", "Submit-another button", { max: 60 }),
      ],
      defaults: {
        reference_label: "Matched · reference",
        heading_matched: `${SELL_ADVISOR_TOKEN} will call you ${SELL_WHEN_TOKEN}.`,
        heading_desk: `An advisor will call you ${SELL_WHEN_TOKEN}.`,
        summary_matched: "— assigned to the advisor who covers your community.",
        summary_desk:
          "— with the Abu Dhabi desk, who will put the right advisor on it.",
        desk_name: "Bazar advisory desk",
        desk_role: "Abu Dhabi · Sell, rent and management",
        desk_initials: "BZ",
        call_label: "Call now",
        steps_label: "What happens next",
        steps: [
          {
            enabled: true,
            when: "Today",
            what: `${SELL_ADVISOR_TOKEN} calls to confirm the details and answer anything outstanding.`,
          },
          {
            enabled: true,
            when: "Within 48 hours",
            what: "Free valuation visit, photography brief and a pricing recommendation.",
          },
          {
            enabled: true,
            when: "Day 3–5",
            what: "Form A signed, listing goes live across Bazar and the UAE portals.",
          },
        ],
        another_label: "Submit another property",
      },
    },
    {
      key: "pricing",
      label: "Before you price it",
      description: "The three-card band that keeps an owner from price-checking elsewhere.",
      dataNote:
        "The transactions card draws a real 24-month sparkline once the DLD import has run; until then it shows the placeholder copy below rather than an invented trend.",
      fields: [
        eyebrow(),
        heading(),
        body({ max: 400 }),
        {
          key: "cards",
          label: "Cards",
          kind: "list",
          itemLabel: "card",
          max: 4,
          help: "Switch a card off to hide it without deleting it.",
          fields: [
            toggle("enabled", "Show this card"),
            text("eyebrow", "Eyebrow", { max: 60, optional: true }),
            text("title", "Title", { max: 80 }),
            area("desc", "Description", { max: 300 }),
            // Blank either of these and the card renders without a button —
            // useful for a card that is there to inform, not to click.
            text("cta", "Button label", { max: 60, optional: true }),
            link("href", "Button link"),
            toggle("primary", "Filled button"),
            text("visual", "Motif", {
              max: 20,
              optional: true,
              help: "One of: range, transactions, guides. Anything else (or blank) leaves the card without a motif.",
            }),
            image(
              "image",
              "Image",
              "Replaces the motif on this card. Leave unset to keep the drawn one.",
            ),
          ],
        },
        text("range_title", "Range motif · title", { max: 80, optional: true }),
        text("range_low", "Range motif · left label", { max: 30, optional: true }),
        text("range_mid", "Range motif · centre label", {
          max: 30,
          optional: true,
        }),
        text("range_high", "Range motif · right label", {
          max: 30,
          optional: true,
        }),
        area("spark_placeholder", "Transactions motif · placeholder", {
          max: 200,
          optional: false,
          help: "Shown in place of the sparkline until DLD data is imported.",
        }),
        text("spark_note", "Transactions motif · caption", {
          max: 120,
          optional: true,
        }),
        {
          key: "guides",
          label: "Guides motif · links",
          kind: "list",
          itemLabel: "guide",
          max: 6,
          help: "The numbered list on the guides card.",
          fields: [
            toggle("enabled", "Show this guide"),
            text("title", "Title", { max: 120 }),
            text("kicker", "Kicker", { max: 40, optional: true }),
            link("href", "Link"),
          ],
        },
      ],
      defaults: {
        eyebrow: "Before you price it",
        heading: "Three ways to get the number right.",
        body: "Overpricing costs more time than any other decision an owner makes. Start with the data before you start with an opinion.",
        cards: [
          {
            enabled: true,
            eyebrow: "Valuation tool",
            title: "Start with the right price",
            desc: "An instant, data-backed range for your unit — built from registered Abu Dhabi transactions and comparable listings.",
            cta: "Get your estimate",
            href: "/tools/valuation",
            primary: true,
            visual: "range",
            image: { media_id: null, alt: null, label: null },
          },
          {
            enabled: true,
            eyebrow: "Abu Dhabi transactions",
            title: "See what buyers actually paid",
            desc: "Browse registered sales in your community and benchmark against real closings, not asking prices.",
            cta: "Explore transactions",
            href: "/market-reports",
            primary: false,
            visual: "transactions",
            image: { media_id: null, alt: null, label: null },
          },
          {
            enabled: true,
            eyebrow: "Seller guides",
            title: "Everything you need to know",
            desc: "Written by the advisors who do this daily — the paperwork, the fees, and the mistakes that cost owners months.",
            cta: "Read the guides",
            href: "/guides",
            primary: false,
            visual: "guides",
            image: { media_id: null, alt: null, label: null },
          },
        ],
        // Deliberately unnumbered: the real range is the one the tool computes
        // for the owner's own unit, and a headline figure here would be a
        // number we made up.
        range_title: "Your range, in AED",
        range_low: "Low",
        range_mid: "Midpoint",
        range_high: "High",
        spark_placeholder:
          "Registered sales by community, building and property type",
        spark_note: "DLD-sourced · updated each quarter",
        // Real pages only — the handoff's three titles ("the seller's document
        // checklist", "what a developer NOC actually costs", "selling with a
        // tenant in place") don't exist yet, and linking to pages that aren't
        // written is worse than linking to the ones that are.
        guides: [
          {
            enabled: true,
            title: "Renting out your property",
            kicker: "Landlords",
            href: "/guides/for-landlords",
          },
          {
            enabled: true,
            title: "The documents you'll be asked for",
            kicker: "Paperwork",
            href: "/guides/required-documents",
          },
          {
            enabled: true,
            title: "What property management covers",
            kicker: "Management",
            href: "/guides/property-management",
          },
        ],
      },
    },
    {
      key: "faq",
      label: "FAQs",
      description: "Questions at the foot of the page, with FAQPage schema for search.",
      dataNote:
        "The phone number comes from Settings → Brand, and the tap-to-call link is built from it. These answers quote Abu Dhabi fees and procedures — have a correction signed off before publishing it.",
      fields: [
        eyebrow(),
        heading(),
        text("phone_intro", "Phone line · before the number", { max: 120 }),
        text("phone_outro", "Phone line · after the number", { max: 160 }),
        text("cta_label", "Button label", { max: 60, optional: true }),
        link("cta_href", "Button link"),
        faqList(),
      ],
      defaults: {
        eyebrow: "Questions",
        heading: "Frequently asked",
        phone_intro: "Not covered here? Call the desk on",
        phone_outro: "— you'll get an advisor, not a call centre.",
        cta_label: "Book a consultation",
        cta_href: "/contact",
        items: [
          {
            q: "How do I get matched with an advisor?",
            a: "Fill in the form above with the property details and how to reach you. It routes to the single Bazar advisor who covers your community — not a shared pool — and they call you directly, usually within two hours during business hours.",
          },
          {
            q: "What documents do I need to sell my property?",
            a: "The original title deed, your passport and Emirates ID, a developer NOC, Form A (the agency agreement you sign with us) and Form F / MOU once a buyer is agreed. If the property is mortgaged, your bank will also need to issue a liability letter.",
          },
          {
            q: "Do I need a licensed agent?",
            a: "Sale and lease agreements in Abu Dhabi are transacted through ADREC-registered brokers. A licensed advisor keeps the paperwork compliant, handles negotiation, and files the transfer with the Department of Municipalities and Transport on your behalf.",
          },
          {
            q: "Can I sell a property that is currently rented?",
            a: "Yes. The buyer normally takes on the existing tenancy contract for its remaining term. If you need the property vacant at handover, UAE tenancy law requires twelve months' written notice served through a notary or registered post.",
          },
          {
            q: "What are the main costs of selling or renting out?",
            a: "Selling: a 2% transfer fee to the municipality, agency commission of 2% plus VAT, and a developer NOC fee — typically AED 500 to 5,000. Renting out: Tawtheeq registration, ADDC connection charges, and agency commission where applicable.",
          },
          {
            q: "How do I work out what my property is worth?",
            a: "Start with the Bazar valuation tool for an instant range built from registered Abu Dhabi transactions, service charges and comparable listings. Your advisor then walks the property and refines it — the visit is free, with no obligation to list.",
          },
        ],
      },
    },
  ],
};
