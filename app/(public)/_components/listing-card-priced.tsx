"use client";

import { ListingCard, type ListingCardProps } from "@/components/brand/listing-card";
import {
  areaUnitLabel,
  formatAreaValue,
  formatPrice,
  usePreferences,
} from "@/lib/preferences";

/**
 * Wraps ListingCard so the price *and* the area re-format client-side from
 * the visitor's preferences (currency: AED / USD, area: ft² / m²) once
 * hydration completes.
 *
 * The parent route passes both a server-side AED-formatted `price` string
 * (matches the SSR HTML, avoids a hydration mismatch) and the raw `priceAed`
 * number. On the client we override `price` with the preferences-aware
 * formatter — keeping the static-caching story intact. `area` is already the
 * raw ft² number at every call site, so it needs no server-rendered twin.
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

  // `area` is typed `number | string` on the card. Only convert when it is a
  // number — a pre-formatted string from a caller is left alone rather than
  // silently mis-converted.
  const numericArea = typeof props.area === "number" ? props.area : null;
  const area =
    numericArea != null ? formatAreaValue(numericArea, prefs.area_unit) : props.area;

  return (
    <ListingCard
      {...props}
      price={price}
      area={area}
      areaUnit={areaUnitLabel(prefs.area_unit)}
    />
  );
}
