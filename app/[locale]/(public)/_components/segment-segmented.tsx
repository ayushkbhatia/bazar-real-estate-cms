"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useQueryStates } from "nuqs";
import { filterParsers } from "@/lib/filters/property";
import { PROPERTY_SEGMENTS } from "@/lib/schemas/property";
import { cn } from "@/lib/utils";

/**
 * Residential / Commercial, above the results.
 *
 * REPLACES the four-pill Buy · Rent · Off-plan · Commercial strip that used to
 * sit here. That strip navigated between the four `…/search` routes, which put
 * the transaction axis in two places at once: the visitor had already chosen
 * Buy or Rent from the nav before they arrived, and the strip then asked them
 * again. It also offered "Commercial" as a fourth alternative to Buy and Rent,
 * which it is not — a commercial unit is for sale or to let like any other, and
 * `mode = 'commercial'` forced a listing to record one of those two facts and
 * drop the other.
 *
 * So the strip now filters the axis the route does NOT already fix: what kind
 * of building it is. Mode switching lives in the megamenu (Buy / Rent / New
 * Projects), which is where it was always duplicated from.
 *
 * Toggle buttons rather than radios, deliberately. A radio group cannot be
 * un-chosen, and "neither" is a real state here — it is what an unfiltered
 * search shows, and it has to be reachable by clicking, not only by arriving
 * with a clean URL. `aria-pressed` is the ARIA for exactly that.
 */
export function SegmentSegmented() {
  const t = useTranslations("search");
  const [{ segment }, setState] = useQueryStates(filterParsers, {
    shallow: false, // re-fetch the RSC page on change
  });
  const [pending, startTransition] = useTransition();

  function toggle(value: (typeof PROPERTY_SEGMENTS)[number]) {
    startTransition(() => {
      // `page: null` because narrowing the results invalidates the offset —
      // filtering to Commercial while on page 3 of the residential stock would
      // land on an empty page that looks like an empty catalogue.
      void setState({ segment: segment === value ? null : value, page: null });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("segment.label")}
      aria-busy={pending || undefined}
      className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5"
    >
      {PROPERTY_SEGMENTS.map((value) => {
        const active = segment === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(value)}
            className={cn(
              // 44px tall on a phone, 32px from `md` up — the same hand-rolled
              // <button> the mode strip used, so the `(pointer: coarse)` floor
              // in globals.css cannot reach it and the height is set here.
              "h-11 px-3.5 md:h-8 md:px-3 rounded text-[12.5px] transition-colors",
              active
                ? "bg-bz-navy text-bz-bg font-medium"
                : "text-bz-ink-2 hover:text-bz-ink",
            )}
          >
            {t(`segment.${value}`)}
          </button>
        );
      })}
    </div>
  );
}
