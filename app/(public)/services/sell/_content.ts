/**
 * Copy for /services/sell that a non-engineer will want to change.
 *
 * The FAQ quotes specific Abu Dhabi fees, procedures and notice periods (the
 * 2% transfer fee, the NOC range, the twelve-month vacancy notice, Tawtheeq,
 * ADREC, DMT). The design handoff flags these for compliance sign-off and asks
 * for them to be content-managed rather than hardcoded. They are collected here
 * as the first half of that: one file to correct, no JSX to edit. Moving them
 * into the master-pages editor is tracked in docs/FOLLOWUPS.md.
 */

export const SELL_FAQ: [string, string][] = [
  [
    "How do I get matched with an advisor?",
    "Fill in the form above with the property details and how to reach you. It routes to the single Bazar advisor who covers your community — not a shared pool — and they call you directly, usually within two hours during business hours.",
  ],
  [
    "What documents do I need to sell my property?",
    "The original title deed, your passport and Emirates ID, a developer NOC, Form A (the agency agreement you sign with us) and Form F / MOU once a buyer is agreed. If the property is mortgaged, your bank will also need to issue a liability letter.",
  ],
  [
    "Do I need a licensed agent?",
    "Sale and lease agreements in Abu Dhabi are transacted through ADREC-registered brokers. A licensed advisor keeps the paperwork compliant, handles negotiation, and files the transfer with the Department of Municipalities and Transport on your behalf.",
  ],
  [
    "Can I sell a property that is currently rented?",
    "Yes. The buyer normally takes on the existing tenancy contract for its remaining term. If you need the property vacant at handover, UAE tenancy law requires twelve months' written notice served through a notary or registered post.",
  ],
  [
    "What are the main costs of selling or renting out?",
    "Selling: a 2% transfer fee to the municipality, agency commission of 2% plus VAT, and a developer NOC fee — typically AED 500 to 5,000. Renting out: Tawtheeq registration, ADDC connection charges, and agency commission where applicable.",
  ],
  [
    "How do I work out what my property is worth?",
    "Start with the Bazar valuation tool for an instant range built from registered Abu Dhabi transactions, service charges and comparable listings. Your advisor then walks the property and refines it — the visit is free, with no obligation to list.",
  ],
];

/** The three trust points beside the form. */
export const SELL_TRUST_POINTS: [string, string][] = [
  [
    "ADREC-licensed advisors",
    "Every advisor registered, vetted and named on your file",
  ],
  [
    "No upfront fees",
    "Photography, listing and portal spend are on us. Commission on completion only",
  ],
  [
    "One point of contact",
    "No handoffs between a lister, a viewer and a closer",
  ],
];

/**
 * The guides the "Seller guides" card lists. Real pages only — the handoff's
 * three titles ("the seller's document checklist", "what a developer NOC
 * actually costs", "selling with a tenant in place") don't exist yet, and
 * linking to pages that aren't written is worse than linking to the ones that
 * are.
 */
export const SELL_GUIDE_LINKS: { href: string; title: string; kicker: string }[] =
  [
    {
      href: "/guides/for-landlords",
      title: "Renting out your property",
      kicker: "Landlords",
    },
    {
      href: "/guides/required-documents",
      title: "The documents you'll be asked for",
      kicker: "Paperwork",
    },
    {
      href: "/guides/property-management",
      title: "What property management covers",
      kicker: "Management",
    },
  ];
