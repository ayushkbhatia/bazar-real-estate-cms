import { env } from "@/lib/env";

function siteUrl(): string {
  return (
    env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app"
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

/** Default organisation block usable site-wide. */
export function organizationJsonLd(): Record<string, unknown> {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Bazar Real Estate",
    url,
    logo: `${url}/icon.png`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Abu Dhabi",
      addressCountry: "AE",
    },
    areaServed: { "@type": "Country", name: "United Arab Emirates" },
  };
}
