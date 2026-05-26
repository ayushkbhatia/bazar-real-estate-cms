"use client";

import {
  ListingCard,
  type ListingCardProps,
} from "@/components/brand/listing-card";
import { formatPrice, usePreferences } from "@/lib/preferences";

/**
 * T1-B cleanup: thin client wrapper around the brand-locked ListingCard
 * that re-formats the price through the user's currency preference. Used
 * by the "Similar properties" rail on `/p/[slug]`. The card itself stays
 * a brand component — we just intercept the price string before passing
 * it down.
 *
 * Server-side, the wrapping page passes the AED-formatted string in
 * `price`. After hydration, we override with the preferences-aware
 * formatter if `priceAed` is set. No SSR mismatch because the SSR-shipped
 * string is also valid output (AED default).
 */
type Props = ListingCardProps & { priceAed?: number | null };

export function SimilarCard({ priceAed, ...props }: Props) {
  const { prefs } = usePreferences();
  const price =
    priceAed != null ? formatPrice(priceAed, prefs) : props.price;
  return <ListingCard {...props} price={price} />;
}
