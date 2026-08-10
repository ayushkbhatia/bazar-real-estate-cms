import { mediaPublicUrl } from "@/lib/media";
import {
  formatPriceAED,
  propertyUrl,
  type ListingRow,
} from "@/lib/queries/properties";
import type { ListingCardProps } from "@/components/brand/listing-card";

/** `ListingCardProps` plus the raw AED price the client wrapper re-formats. */
export type FeaturedCardProps = ListingCardProps & { priceAed: number | null };

/**
 * Map a curated `ListingRow` onto `ListingCard` props for the marketing
 * featured rows. `propertyId` is what makes the card's shortlist button
 * appear — the store behind it is localStorage, so no provider is needed.
 *
 * `price` stays the AED string so SSR matches first paint; `priceAed` and the
 * raw ft² `area` let `ListingCardPriced` re-render both in the visitor's
 * chosen currency and area unit after hydration.
 */
export function listingRowToCard(row: ListingRow): FeaturedCardProps {
  return {
    propertyId: row.id,
    price: formatPriceAED(row.price_aed),
    priceAed: row.price_aed,
    title: row.title,
    location: row.areas?.name ?? "United Arab Emirates",
    beds: row.beds,
    baths: row.baths,
    area: row.built_up_ft2 ?? 0,
    imgLabel: row.reference,
    heroSrc: row.hero ? mediaPublicUrl(row.hero.storage_key) : null,
    heroAlt: row.hero?.alt_text ?? row.title,
    href: propertyUrl(row),
  };
}
