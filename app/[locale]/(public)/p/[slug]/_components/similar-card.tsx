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
 * Thin client wrapper around the brand-locked ListingCard that formats price
 * and area from the visitor's preferences. Used by the "Nearby Properties"
 * rail on `/p/[slug]`. The card itself stays a brand component — we just
 * format the strings before passing them down.
 *
 * Same shape as `ListingCardPriced`; see its docblock for why `price` is a
 * fallback rather than an SSR twin.
 */
type Props = Omit<ListingCardProps, "price"> & {
  priceAed?: number | null;
  /** Pre-formatted fallback, for callers that have no raw AED figure. */
  price?: string;
};

export function SimilarCard({ priceAed, ...props }: Props) {
  const { prefs } = usePreferences();
  const price =
    priceAed != null ? formatPrice(priceAed, prefs) : (props.price ?? "—");
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
