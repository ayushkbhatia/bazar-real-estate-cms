/**
 * Sprint 13 — Property Finder syndication.
 *
 * Property Finder accepts an XML feed at a partner-shared URL. We host
 * /api/feeds/property-finder.xml (pull-based) and gate access by the
 * PROPERTY_FINDER_FEED_TOKEN query param so portal credentials don't
 * leak to other crawlers.
 *
 * Schema follows the Property Finder partner spec circa 2025:
 * <listings><listing>...</listing></listings> with a small set of
 * Property Finder-specific category codes mapped from our internal
 * property type enum.
 */

import { env } from "@/lib/env";

export type FeedProperty = {
  reference: string;
  slug: string;
  title: string;
  description: string | null;
  type: string;
  mode: "buy" | "rent" | "off_plan" | "commercial";
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  price_aed: number;
  area_name: string | null;
  area_slug: string | null;
  geo: { lat: number; lng: number } | null;
  hero_url: string | null;
  permit_number: string | null;
  permit_expires_at: string | null;
  agent_name: string | null;
  agent_brn: string | null;
  agent_phone: string | null;
  agent_email: string | null;
  published_at: string | null;
};

const PROPERTY_TYPE_TO_PORTAL: Record<string, string> = {
  apartment: "AP",
  villa: "VH",
  penthouse: "PH",
  townhouse: "TH",
  commercial: "OF",
  land: "LD",
  hotel_apartment: "HA",
};

const MODE_TO_OFFERING: Record<FeedProperty["mode"], string> = {
  buy: "RS",
  rent: "RR",
  off_plan: "RS",
  commercial: "RS",
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

/** Verify the inbound feed-token query param matches env. */
export function verifyPropertyFinderToken(presented: string | null): boolean {
  if (!env.PROPERTY_FINDER_FEED_TOKEN) {
    // Allow access when no token is configured — lets the feed work
    // out of the box for non-prod deployments. Production deploys MUST
    // set the env var.
    return true;
  }
  return presented === env.PROPERTY_FINDER_FEED_TOKEN;
}

/** Render the full <listings>...</listings> XML body. */
export function renderPropertyFinderFeed(items: FeedProperty[]): string {
  const listings = items.map((p) => renderListing(p)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<list>
${listings}
</list>`;
}

function renderListing(p: FeedProperty): string {
  const category = PROPERTY_TYPE_TO_PORTAL[p.type] ?? "AP";
  const offering = MODE_TO_OFFERING[p.mode];
  const features =
    p.hero_url
      ? `<photo><url>${escapeXml(p.hero_url)}</url><last_update>${escapeXml(p.published_at ?? "")}</last_update></photo>`
      : "";
  return `  <property>
    ${maybe("reference_number", p.reference)}
    ${maybe("title_en", p.title)}
    ${maybe("description_en", p.description?.slice(0, 4000) ?? "")}
    ${maybe("price", p.price_aed)}
    ${maybe("price_period", offering === "RR" ? "Y" : "")}
    ${maybe("offering_type", offering)}
    ${maybe("property_type", category)}
    ${maybe("bedroom", p.beds)}
    ${maybe("bathroom", p.baths)}
    ${maybe("size", p.built_up_ft2)}
    ${maybe("city", "Abu Dhabi")}
    ${maybe("community", p.area_name)}
    ${maybe("latitude", p.geo?.lat)}
    ${maybe("longitude", p.geo?.lng)}
    ${maybe("permit_number", p.permit_number)}
    ${maybe("agent_name", p.agent_name)}
    ${maybe("agent_phone", p.agent_phone)}
    ${maybe("agent_email", p.agent_email)}
    ${maybe("agent_orn_number", p.agent_brn)}
    ${maybe("last_updated", p.published_at)}
    ${features}
  </property>`;
}
