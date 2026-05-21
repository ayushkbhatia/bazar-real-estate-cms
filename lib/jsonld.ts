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
 * Returns a JSON-LD object for a property — schema.org `Product` with a
 * nested `Offer` and (when geo is available) a `Place`. Real estate
 * portals typically use Product + RealEstateAgent + Place; this is the
 * minimum useful set for Google rich results.
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
    "@type": "Product",
    "@id": url,
    url,
    name: p.title,
    description: p.short_description || p.description || p.title,
    image: images,
    sku: p.reference,
    productID: p.reference,
    category: "real estate",
    additionalType: "https://schema.org/Accommodation",
    isRelatedTo: accommodation,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "AED",
      price: p.price_aed,
      availability: "https://schema.org/InStock",
      validFrom: p.published_at ?? undefined,
      itemCondition: "https://schema.org/UsedCondition",
      seller: {
        "@type": "Organization",
        name: "Bazar Real Estate",
        url: siteUrl(),
      },
    },
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
