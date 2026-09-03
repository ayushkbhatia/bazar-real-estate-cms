"use client";

import {
  ListingCard,
  type ListingCardProps,
} from "@/components/brand/listing-card";
import {
  areaUnitLabel,
  formatAreaValue,
  formatPrice,
  usePreferences,
} from "@/lib/preferences";

/**
 * Wraps ListingCard so the price *and* the area re-format from the visitor's
 * preferences (currency: AED / USD, area: ft² / m²).
 *
 * Callers pass the raw `priceAed` number and the raw ft² `area`; this formats
 * both. `useSyncExternalStore` hands `getServerSnapshot` to SSR *and* to the
 * hydration render, so both passes format at the AED/ft² default and agree —
 * the swap happens on the render after hydration.
 *
 * Routes used to also pass a server-formatted `price` string alongside
 * `priceAed`, on the theory that it was the SSR twin. It never rendered: the
 * line below has always overridden it whenever `priceAed` is set. It survives
 * only for the handful of callers that have a display string and no number.
 *
 * This was `ListingCardSaveable`, which also reflected the signed-in visitor's
 * saved set into the heart icon. Customer accounts are gone, so the heart went
 * with them; the currency behaviour has nothing to do with accounts and is why
 * the wrapper still exists. Renamed so the name states what it actually does.
 */
type Props = Omit<ListingCardProps, "price"> & {
  /** Raw price in AED. The card formats it in the visitor's currency. */
  priceAed?: number | null;
  /** Pre-formatted fallback, for callers that have no raw AED figure. */
  price?: string;
};

export function ListingCardPriced({ priceAed, ...props }: Props) {
  const { prefs } = usePreferences();
  const price =
    priceAed != null ? formatPrice(priceAed, prefs) : (props.price ?? "—");

  // `area` is typed `number | string` on the card. Only convert when it is a
  // number — a pre-formatted string from a caller is left alone rather than
  // silently mis-converted.
  const numericArea = typeof props.area === "number" ? props.area : null;
  const area =
    numericArea != null
      ? formatAreaValue(numericArea, prefs.area_unit)
      : props.area;

  return (
    <ListingCard
      {...props}
      price={price}
      area={area}
      areaUnit={areaUnitLabel(prefs)}
    />
  );
}
