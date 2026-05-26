"use client";

import { ListingCard, type ListingCardProps } from "@/components/brand/listing-card";
import { useSavedIds } from "./saved-ids-provider";
import { formatPrice, usePreferences } from "@/lib/preferences";

// Wraps ListingCard so:
//   (1) the heart icon reflects the signed-in user's saved set without
//       forcing the parent route to render dynamically
//   (2) the price re-formats client-side from the user's currency
//       preference (USD / EUR / AED) once hydration completes
//
// The parent route passes both a server-side AED-formatted `price` string
// (matches SSR HTML, avoids hydration mismatch) and the raw `priceAed`
// number. On the client we override `price` with the preferences-aware
// formatter — keeping the static-caching story intact.
type Props = ListingCardProps & {
  /** Raw price in AED. When provided, ListingCardSaveable re-formats it
   *  on the client through the active currency preference. */
  priceAed?: number | null;
};

export function ListingCardSaveable({ priceAed, ...props }: Props) {
  const { ids, isAuthed, loaded } = useSavedIds();
  const { prefs } = usePreferences();
  const initialSaved = props.propertyId ? ids.has(props.propertyId) : false;

  const price =
    priceAed != null
      ? formatPrice(priceAed, prefs)
      : props.price;

  return (
    <ListingCard
      {...props}
      key={loaded ? "loaded" : "pending"}
      price={price}
      initialSaved={initialSaved}
      isAuthed={isAuthed}
    />
  );
}
