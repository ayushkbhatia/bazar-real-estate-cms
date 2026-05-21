/**
 * Format an inferred concierge brief into the prefilled message body for
 * the "Hand-off to advisor via WhatsApp" link. Pure — easy to unit-test
 * and decoupled from the chat UI.
 *
 * The resulting message:
 *   · skips lines whose fields aren't set (sparse-brief friendly),
 *   · always ends with a polite opener so a barely-filled brief still
 *     produces a usable message,
 *   · keeps a stable order so the advisor reads the same shape every time.
 */

import type { ConciergeBrief } from "./brief";

const MODE_LABEL: Record<string, string> = {
  buy: "Buy",
  rent: "Rent",
  off_plan: "Off-plan",
  commercial: "Commercial",
};

function formatAedShort(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toLocaleString()}`;
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function bedsLine(brief: ConciergeBrief): string | null {
  const min = brief.beds_min;
  const max = brief.beds_max;
  if (min == null && max == null) return null;
  if (min != null && max != null && min === max) return `Beds: ${min}`;
  if (min != null && max != null) return `Beds: ${min}–${max}`;
  if (min != null) return `Beds: ${min}+`;
  return `Beds: up to ${max}`;
}

function budgetLine(brief: ConciergeBrief): string | null {
  const min = brief.price_min;
  const max = brief.price_max;
  if (min == null && max == null) return null;
  if (min != null && max != null)
    return `Budget: ${formatAedShort(min)} – ${formatAedShort(max)}`;
  if (min != null) return `Budget: from ${formatAedShort(min)}`;
  return `Budget: up to ${formatAedShort(max!)}`;
}

export function formatBriefForWhatsApp(brief: ConciergeBrief): string {
  const lines: string[] = [];
  lines.push("Hi Bazar — I'd like an advisor's view on this brief.");

  const details: string[] = [];
  if (brief.mode && MODE_LABEL[brief.mode]) {
    details.push(`Looking to: ${MODE_LABEL[brief.mode]}`);
  }
  if (brief.area_slugs && brief.area_slugs.length > 0) {
    details.push(
      `Area${brief.area_slugs.length === 1 ? "" : "s"}: ${brief.area_slugs.map(humanizeSlug).join(", ")}`,
    );
  }
  if (brief.property_types && brief.property_types.length > 0) {
    details.push(
      `Type: ${brief.property_types.map(humanizeSlug).join(", ")}`,
    );
  }
  const beds = bedsLine(brief);
  if (beds) details.push(beds);
  const budget = budgetLine(brief);
  if (budget) details.push(budget);
  if (
    brief.must_have_amenities &&
    brief.must_have_amenities.length > 0
  ) {
    details.push(`Must have: ${brief.must_have_amenities.join(", ")}`);
  }
  if (brief.flags) {
    const flagBits: string[] = [];
    if (brief.flags.exclusive) flagBits.push("exclusive only");
    if (brief.flags.vacant_on_transfer) flagBits.push("vacant on transfer");
    if (brief.flags.mortgage_eligible) flagBits.push("mortgageable now");
    if (flagBits.length > 0) details.push(`Filters: ${flagBits.join(", ")}`);
  }

  if (details.length > 0) {
    lines.push("");
    lines.push(...details);
  }

  return lines.join("\n");
}
