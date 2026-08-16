import { env } from "@/lib/env";

function siteUrl(): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae"
  ).replace(/\/+$/, "");
}

type PropertyForJsonLd = {
  reference: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  price_aed: number;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  type: string;
  mode: string;
  geo: { lat: number; lng: number } | null;
  areas: { name: string; slug: string } | null;
  hero: { storage_key: string; alt_text: string | null } | null;
  published_at: string | null;
};

/**
 * Returns a JSON-LD object for a property using schema.org `RealEstateListing`
 * (replaces the earlier `Product` shape). Includes a nested
 * `Accommodation` + `Offer` and `GeoCoordinates` when available. Sprint 4c.
 */
export function propertyJsonLd(
  p: PropertyForJsonLd,
  heroPublicUrl: string | null,
): Record<string, unknown> {
  const url = `${siteUrl()}/p/${p.slug}-${p.reference.toLowerCase()}`;
  const images = heroPublicUrl ? [heroPublicUrl] : undefined;

  const accommodation: Record<string, unknown> = {
    "@type": "Accommodation",
    name: p.title,
    numberOfBedrooms: p.beds,
    numberOfBathroomsTotal: p.baths,
    floorSize: p.built_up_ft2
      ? { "@type": "QuantitativeValue", value: p.built_up_ft2, unitCode: "FTK" }
      : undefined,
    accommodationCategory: p.type,
    address: p.areas
      ? {
          "@type": "PostalAddress",
          addressLocality: p.areas.name,
          addressCountry: "AE",
        }
      : undefined,
    geo: p.geo
      ? {
          "@type": "GeoCoordinates",
          latitude: p.geo.lat,
          longitude: p.geo.lng,
        }
      : undefined,
  };

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": url,
    url,
    name: p.title,
    description: p.short_description || p.description || p.title,
    image: images,
    identifier: p.reference,
    datePosted: p.published_at ?? undefined,
    mainEntity: accommodation,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "AED",
      price: p.price_aed,
      availability: "https://schema.org/InStock",
      validFrom: p.published_at ?? undefined,
      seller: {
        "@type": "RealEstateAgent",
        name: "Bazar Real Estate",
        url: siteUrl(),
      },
    },
  };
}

/** Breadcrumb JSON-LD — used on property pages and articles. */
export function breadcrumbListJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Article JSON-LD — used on insights articles. Sprint 5d. */
type ArticleForJsonLd = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  published_at: string | null;
  updated_at: string | null;
  read_minutes: number | null;
  author?: { display_name: string; slug: string } | null;
};

export function articleJsonLd(
  a: ArticleForJsonLd,
  heroPublicUrl: string | null,
): Record<string, unknown> {
  const url = `${siteUrl()}/insights/${a.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": url,
    url,
    headline: a.title,
    description: a.excerpt ?? a.title,
    image: heroPublicUrl ? [heroPublicUrl] : undefined,
    datePublished: a.published_at ?? undefined,
    dateModified: a.updated_at ?? a.published_at ?? undefined,
    articleSection: a.category,
    timeRequired: a.read_minutes ? `PT${a.read_minutes}M` : undefined,
    author: a.author
      ? {
          "@type": "Person",
          name: a.author.display_name,
          url: `${siteUrl()}/insights/author/${a.author.slug}`,
        }
      : undefined,
    publisher: {
      "@type": "Organization",
      name: "Bazar Real Estate",
      url: siteUrl(),
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl()}/icon.png`,
      },
    },
    mainEntityOfPage: url,
  };
}

/** Default organisation block usable site-wide. */
/**
 * The site-wide Organization block, rendered in the root layout's <head>.
 *
 * `logo` is what a search engine draws beside the result and in a knowledge
 * panel, so it takes the CMS value (Brand & identity → "Search-result logo",
 * already resolved and absolutised by `resolveSearchIcon`). The parameter is
 * optional so the block still renders during a Supabase outage; the default
 * points at the wordmark actually shipped in /public. It used to point at
 * `/icon.png`, which has never existed in this repo — a 404 for the logo is
 * exactly how a result row ends up with a blank generic mark.
 */
export function organizationJsonLd(
  logoUrl?: string | null,
): Record<string, unknown> {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Bazar Real Estate",
    url,
    logo: logoUrl ?? `${url}/brand/bazar-logo.png`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Abu Dhabi",
      addressCountry: "AE",
    },
    areaServed: { "@type": "Country", name: "United Arab Emirates" },
  };
}

/** Per-area Place JSON-LD — used on /areas/[slug]. Sprint 11. */
type AreaForJsonLd = {
  slug: string;
  name: string;
  intro_md: string | null;
};

export function placeJsonLd(a: AreaForJsonLd): Record<string, unknown> {
  const url = `${siteUrl()}/areas/${a.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": url,
    url,
    name: a.name,
    description: a.intro_md ?? a.name,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Abu Dhabi",
      addressCountry: "AE",
    },
  };
}

/** Per-agent RealEstateAgent JSON-LD — used on /agents/[slug]. Sprint 11. */
type AgentForJsonLd = {
  slug: string;
  display_name: string;
  title: string | null;
  bio: string | null;
  brn: string | null;
  photo_url: string | null;
  languages: string[];
};

export function realEstateAgentJsonLd(
  a: AgentForJsonLd,
): Record<string, unknown> {
  const url = `${siteUrl()}/agents/${a.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": url,
    url,
    name: a.display_name,
    jobTitle: a.title ?? "Advisor",
    description: a.bio ?? undefined,
    image: a.photo_url ?? undefined,
    identifier: a.brn ?? undefined,
    knowsLanguage: a.languages.length > 0 ? a.languages : undefined,
    worksFor: {
      "@type": "Organization",
      name: "Bazar Real Estate",
      url: siteUrl(),
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Abu Dhabi",
      addressCountry: "AE",
    },
  };
}
