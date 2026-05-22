/**
 * Sprint 13 — Bayut syndication.
 *
 * Bayut's XML feed schema is similar to Property Finder's but uses
 * different tag names. We keep the FeedProperty shape shared and
 * remap on render. Token verification mirrors Property Finder.
 */

import { env } from "@/lib/env";
import type { FeedProperty } from "./property-finder";

const PROPERTY_TYPE_TO_BAYUT: Record<string, string> = {
  apartment: "Apartment",
  villa: "Villa",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  commercial: "Office",
  land: "Land",
  hotel_apartment: "Hotel Apartment",
};

const MODE_TO_BAYUT_PURPOSE: Record<FeedProperty["mode"], string> = {
  buy: "Sale",
  rent: "Rent",
  off_plan: "Sale",
  commercial: "Sale",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function maybe(tag: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `<${tag}>${escapeXml(String(value))}</${tag}>`;
}

export function verifyBayutToken(presented: string | null): boolean {
  if (!env.BAYUT_FEED_TOKEN) return true;
  return presented === env.BAYUT_FEED_TOKEN;
}

export function renderBayutFeed(items: FeedProperty[]): string {
  const listings = items.map((p) => renderListing(p)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<listings>
${listings}
</listings>`;
}

function renderListing(p: FeedProperty): string {
  const category = PROPERTY_TYPE_TO_BAYUT[p.type] ?? "Apartment";
  const purpose = MODE_TO_BAYUT_PURPOSE[p.mode];
  return `  <listing>
    ${maybe("reference_number", p.reference)}
    ${maybe("title", p.title)}
    ${maybe("description", p.description?.slice(0, 4000) ?? "")}
    ${maybe("price", p.price_aed)}
    ${maybe("purpose", purpose)}
    ${maybe("category", category)}
    ${maybe("bedrooms", p.beds)}
    ${maybe("bathrooms", p.baths)}
    ${maybe("size", p.built_up_ft2)}
    ${maybe("city", "Abu Dhabi")}
    ${maybe("community", p.area_name)}
    ${maybe("latitude", p.geo?.lat)}
    ${maybe("longitude", p.geo?.lng)}
    ${maybe("permit", p.permit_number)}
    <agent>
      ${maybe("name", p.agent_name)}
      ${maybe("phone", p.agent_phone)}
      ${maybe("email", p.agent_email)}
      ${maybe("license", p.agent_brn)}
    </agent>
    ${p.hero_url ? `<image><url>${escapeXml(p.hero_url)}</url></image>` : ""}
    ${maybe("last_updated", p.published_at)}
  </listing>`;
}
