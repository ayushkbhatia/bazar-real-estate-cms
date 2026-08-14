"use client";

import { useTranslations } from "next-intl";

import { Eyebrow } from "@/components/brand/eyebrow";
import {
  formatPrice,
  formatPricePerArea,
  usePreferences,
} from "@/lib/preferences";

/**
 * Property-detail price block. Headline + price-per-area + secondary-currency
 * equivalent + "Listed N days ago" pill.
 *
 * Everything here goes through the shared formatters. It used to keep three
 * local reimplementations — a `formattedAed` SSR string the server passed in,
 * a hand-rolled compactor for the cross-check figure, and its own copy of
 * `FT2_PER_M2` — and each one had drifted: the same listing read `AED 7.9M`
 * here and `AED 7.94M` on its own card, and the per-area line put the unit on
 * the wrong side of the number ("1,850 AED/ft²" against "AED 1,850/ft²"
 * everywhere else). One formatter per figure, no local copies.
 */
export function PriceBlock({
  priceAed,
  aedPerFt2,
  listedDays,
}: {
  priceAed: number;
  aedPerFt2: number | null;
  listedDays: number | null;
}) {
  const t = useTranslations("property");
  const { prefs } = usePreferences();
  const headline = formatPrice(priceAed, prefs);

  // Surface the other currency as a sanity-check line. With AED selected we
  // show the USD equivalent; with USD selected we show AED, the canonical
  // schema number.
  const otherCurrency = prefs.currency === "AED" ? "USD" : "AED";
  const otherLabel = formatPrice(priceAed, { currency: otherCurrency });

  const subline = aedPerFt2 ? formatPricePerArea(aedPerFt2, prefs) : null;

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
            {t("spec.listed")} {t("listedAgo", { days: listedDays })}
          </Eyebrow>
        ) : null}
      </div>
    </div>
  );
}
