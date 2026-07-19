"use client";

import { Eyebrow } from "@/components/brand/eyebrow";
import {
  convertFromAed,
  currencySymbol,
  formatPrice,
  usePreferences,
} from "@/lib/preferences";

/**
 * Property-detail price block.  Headline + AED/ft² + secondary-currency
 * equivalent + "Listed N days ago" pill.
 *
 * T1-B cleanup: now a client component that respects the user's currency
 * preference.  Headline price re-formats through `formatPrice`; the
 * "AED/ft²" sub-line stays in the schema unit so it's directly comparable
 * to other listings.  The secondary-currency equivalent (USD by default,
 * EUR or AED depending on the preference) sits next to it.
 *
 * Server passes `formattedAed` as the SSR fallback to avoid hydration
 * flicker before client preferences resolve.
 */
const FT2_PER_M2 = 10.7639;

export function PriceBlock({
  priceAed,
  aedPerFt2,
  listedDays,
  formattedAed,
}: {
  priceAed: number;
  aedPerFt2: number | null;
  listedDays: number | null;
  formattedAed: string;
}) {
  const { prefs } = usePreferences();
  const headline =
    prefs.currency === "AED" ? formattedAed : formatPrice(priceAed, prefs);

  // Surface the "other major" currency as a sanity-check line. When the
  // user has AED selected we still show the USD equivalent; when they
  // have USD or EUR we show AED so they can cross-check against the
  // canonical schema number.
  const otherCurrency = prefs.currency === "AED" ? "USD" : "AED";
  const otherValue = convertFromAed(priceAed, otherCurrency);
  const otherLabel =
    otherValue >= 1_000_000
      ? `${currencySymbol(otherCurrency)} ${(otherValue / 1_000_000).toFixed(2)}M`
      : otherValue >= 1000
        ? `${currencySymbol(otherCurrency)} ${(otherValue / 1000).toFixed(0)}k`
        : `${currencySymbol(otherCurrency)} ${Math.round(otherValue).toLocaleString()}`;

  // AED/ft² subline — convert to the user's currency-per-area unit when
  // either changes from default.
  const subline = (() => {
    if (!aedPerFt2) return null;
    if (prefs.currency === "AED" && prefs.area_unit === "ft2") {
      return `${aedPerFt2.toLocaleString()} AED/ft²`;
    }
    const inCurrency = convertFromAed(aedPerFt2, prefs.currency);
    const final =
      prefs.area_unit === "m2" ? inCurrency * FT2_PER_M2 : inCurrency;
    const unit = prefs.area_unit === "m2" ? "m²" : "ft²";
    return `${currencySymbol(prefs.currency)} ${Math.round(final).toLocaleString()}/${unit}`;
  })();

  return (
    <div className="flex items-baseline gap-4 flex-wrap">
      <span
        className="serif text-[56px] font-normal leading-none text-bz-navy"
        style={{ letterSpacing: "-0.025em" }}
      >
        {headline}
      </span>
      <div className="flex flex-col gap-1">
        {subline ? (
          <span className="mono text-[13px] text-bz-ink-2">
            {subline} · ~ {otherLabel}
          </span>
        ) : (
          <span className="mono text-[13px] text-bz-ink-2">~ {otherLabel}</span>
        )}
        {listedDays != null ? (
          <Eyebrow className="text-bz-accent">
            Listed{" "}
            {listedDays === 0
              ? "today"
              : listedDays === 1
                ? "1 day ago"
                : `${listedDays} days ago`}
          </Eyebrow>
        ) : null}
      </div>
    </div>
  );
}
