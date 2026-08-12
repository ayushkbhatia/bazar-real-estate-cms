import { mediaPublicUrl } from "@/lib/media";
import { propertyUrl, type ListingRow } from "@/lib/queries/properties";
import type { ListingCardProps } from "@/components/brand/listing-card";

/**
 * `ListingCardProps` minus the pre-formatted `price` string, plus the raw AED
 * figure `ListingCardPriced` formats from.
 */
export type FeaturedCardProps = Omit<ListingCardProps, "price"> & {
  priceAed: number | null;
};

/**
 * Map a curated `ListingRow` onto `ListingCard` props for the marketing
 * featured rows. `propertyId` is what makes the card's shortlist button
 * appear — the store behind it is localStorage, so no provider is needed.
 *
 * Prices and areas travel as raw numbers. `ListingCardPriced` formats them in
 * the visitor's currency and area unit; a pre-formatted string here would just
 * be overridden.
 */
export function listingRowToCard(row: ListingRow): FeaturedCardProps {
  return {
    propertyId: row.id,
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
