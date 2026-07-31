"use client";

import { ListingCard, type ListingCardProps } from "@/components/brand/listing-card";
import { formatPrice, usePreferences } from "@/lib/preferences";

/**
 * Wraps ListingCard so the price re-formats client-side from the visitor's
 * currency preference (USD / EUR / AED) once hydration completes.
 *
 * The parent route passes both a server-side AED-formatted `price` string
 * (matches the SSR HTML, avoids a hydration mismatch) and the raw `priceAed`
 * number. On the client we override `price` with the preferences-aware
 * formatter — keeping the static-caching story intact.
 *
 * This was `ListingCardSaveable`, which also reflected the signed-in visitor's
 * saved set into the heart icon. Customer accounts are gone, so the heart went
 * with them; the currency behaviour has nothing to do with accounts and is why
 * the wrapper still exists. Renamed so the name states what it actually does.
 */
type Props = ListingCardProps & {
  /** Raw price in AED. When provided, the card re-formats it on the client. */
  priceAed?: number | null;
};

export function ListingCardPriced({ priceAed, ...props }: Props) {
  const { prefs } = usePreferences();
  const price = priceAed != null ? formatPrice(priceAed, prefs) : props.price;

  return <ListingCard {...props} price={price} />;
}
