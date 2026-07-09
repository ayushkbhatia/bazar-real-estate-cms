import { mediaPublicUrl } from "@/lib/media";
import {
  formatPriceAED,
  propertyUrl,
  type ListingRow,
} from "@/lib/queries/properties";
import type { ListingCardProps } from "@/components/brand/listing-card";

/**
 * Map a curated `ListingRow` onto `ListingCard` props for the marketing
 * featured rows. Static heart (no `propertyId`) so the section needs no
 * SavedIdsProvider context.
 */
export function listingRowToCard(row: ListingRow): ListingCardProps {
  return {
    price: formatPriceAED(row.price_aed),
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
