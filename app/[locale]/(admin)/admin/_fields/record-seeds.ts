import type { PropertyOption } from "@/lib/queries/featured-properties";
import type { DevelopmentIndexRow } from "@/lib/queries/developments";
import type { AgentProfile } from "@/lib/queries/agents";
import { propertyUrl } from "@/lib/queries/property-utils";
import { PROPERTY_MODE_LABELS, type PropertyMode } from "@/lib/schemas/property";
import { formatArea, formatPrice } from "@/lib/preferences";
import { mediaPublicUrl } from "@/lib/media";
import { quarterLabel } from "@/lib/schemas/development";
import type { SeedItem } from "./types";

/**
 * Live records → picker options, with the detail an editor picks by.
 *
 * Shared by every editor that offers a listing or project picker — the page
 * builder and the home page's featured row — so the two can't disagree about
 * what a listing is called. Pure: the queries run in the page, this only
 * shapes what they returned.
 *
 * /admin is English-only by design, so the figures are formatted with the
 * shipped defaults (AED, ft²) rather than a visitor's preferences.
 */

/** "hotel_apartment" → "Hotel apartment". */
function typeLabel(type: string | null): string | null {
  if (!type) return null;
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function modeLabel(mode: string | null): string | null {
  if (!mode) return null;
  return PROPERTY_MODE_LABELS[mode as PropertyMode] ?? typeLabel(mode);
}

/**
 * One listing as the picker shows it.
 *
 * The name stays the listing's title — it is what the card on the page will
 * say — and everything that tells two same-titled listings apart goes in the
 * detail: the reference, the facts, the price, sale or rent, the photo.
 */
export function propertySeedItem(p: PropertyOption): SeedItem {
  const facts = [
    p.beds != null ? (p.beds === 0 ? "Studio" : `${p.beds} bed`) : null,
    p.baths != null ? `${p.baths} bath` : null,
    p.builtUpFt2 ? formatArea(p.builtUpFt2) : null,
  ].filter((f): f is string => f !== null);
  const href = propertyUrl({ slug: p.slug, reference: p.reference });
  return {
    name: p.title,
    href,
    // A listing is addressed by its reference, not a slug — `slug` is just the
    // seed's stored-value field, so the reference rides in it.
    slug: p.reference,
    detail: {
      thumb: p.heroUrl,
      code: p.reference,
      sub: [typeLabel(p.type), p.areaName].filter(Boolean).join(" · ") || null,
      facts,
      price: p.priceAed ? formatPrice(p.priceAed) : null,
      badge: modeLabel(p.mode),
      href,
    },
  };
}

/** One advisor as the picker shows it — face first, it's a person. */
export function agentSeedItem(a: AgentProfile): SeedItem {
  const href = `/agents/${a.slug}`;
  return {
    name: a.display_name,
    href,
    slug: a.slug,
    detail: {
      thumb: a.photo_url,
      code: a.brn ? `BRN ${a.brn}` : null,
      sub: a.title,
      facts: [
        a.languages.length > 0 ? a.languages.join(", ") : null,
        // The card's two buttons need these; say up front when one is missing
        // rather than let the editor find out from the preview.
        a.phone ? null : "No phone on file",
        a.whatsapp ? null : "No WhatsApp on file",
      ].filter((f): f is string => f !== null),
      price: null,
      badge: null,
      href,
    },
  };
}

/** One project as the picker shows it. */
export function developmentSeedItem(d: DevelopmentIndexRow): SeedItem {
  const href = `/developments/${d.slug}`;
  const handover = d.handover_date ? quarterLabel(d.handover_date) : null;
  return {
    name: d.name,
    href,
    slug: d.slug,
    detail: {
      thumb: d.hero ? mediaPublicUrl(d.hero.storage_key) : null,
      code: d.developer?.name ?? null,
      sub: d.area?.name ?? null,
      facts: [
        d.bedrooms_text ? `${d.bedrooms_text} bed` : null,
        handover && handover !== "—" ? `Handover ${handover}` : null,
        d.total_units ? `${d.total_units} units` : null,
      ].filter((f): f is string => f !== null),
      price: d.starting_price ? `From ${formatPrice(d.starting_price)}` : null,
      badge: d.status === "sold_out" ? "Sold out" : null,
      href,
    },
  };
}
