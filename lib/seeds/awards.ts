/**
 * Editorial awards + press mentions surfaced on the home and /about pages.
 * Hand-curated for now; admin CMS coverage is a follow-up sprint.
 */

export type Award = {
  id: string;
  year: number;
  /** Issued by — developer, industry body, publication. */
  issuer: string;
  /** Short title shown on the card. */
  title: string;
  /** One-sentence context for the eyebrow / tooltip. */
  context: string;
};

export const SEED_AWARDS: Award[] = [
  {
    id: "aldar-q4-top-broker-2025",
    year: 2025,
    issuer: "Aldar",
    title: "Q4 Top Broker",
    context: "Top-quartile Aldar broker by closed transaction volume.",
  },
  {
    id: "modon-recognised-partner-2025",
    year: 2025,
    issuer: "Modon",
    title: "Recognised Partner",
    context: "Performance recognition for Reem Hills and Hudayriyat releases.",
  },
  {
    id: "imkan-channel-partner-2025",
    year: 2025,
    issuer: "Imkan",
    title: "Channel Partner",
    context: "Closed-volume tier reached on Nudra and Sheikha Fatima releases.",
  },
  {
    id: "the-national-press-2026",
    year: 2026,
    issuer: "The National",
    title: "Cited expert · Saadiyat market 2026",
    context: "Quoted in The National's Q1 2026 Abu Dhabi market commentary.",
  },
];

export type PressLogo = {
  id: string;
  label: string;
  /** Public URL or relative path; empty string falls back to a wordmark. */
  href: string;
};

/**
 * Press mentions surfaced on the home trust strip. Use real logo paths when
 * the assets land; until then we render the publication name in serif as a
 * graceful fallback.
 */
export const SEED_PRESS_LOGOS: PressLogo[] = [
  { id: "the-national", label: "The National", href: "" },
  { id: "khaleej-times", label: "Khaleej Times", href: "" },
  { id: "arabian-business", label: "Arabian Business", href: "" },
  { id: "gulf-news", label: "Gulf News", href: "" },
];

/** Curated client testimonials. */
export type Testimonial = {
  id: string;
  quote: string;
  attribution: string;
  context?: string;
};

export const SEED_TESTIMONIALS: Testimonial[] = [
  {
    id: "saadiyat-villa-buyer",
    quote:
      "They told us when to walk away from a deal we'd already shaken hands on. Six months later the project was repriced down 14%. That call was the entire fee, repaid many times over.",
    attribution: "Couple buying on Saadiyat Reserve",
    context: "Off-market resale, 2025",
  },
  {
    id: "off-plan-investor",
    quote:
      "Every other broker pitched me the buildings their developer was paying them most for. Bazar walked me through five projects, told me which two were worth my attention, and rejected the other three on principle. I trust them now.",
    attribution: "Returning investor, London",
    context: "Off-plan, Hudayriyat",
  },
  {
    id: "first-time-buyer",
    quote:
      "First time we'd bought property anywhere. They explained transfer fees, escrow timing, the residency visa pathway, and the wider area economics in a single hour. Nothing felt rushed.",
    attribution: "First-time buyer, Saadiyat Island",
    context: "Resale, 2026",
  },
];
