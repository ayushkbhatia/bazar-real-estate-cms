"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_AMENITIES } from "@/lib/schemas/amenity-taxonomy";

/**
 * Sprint 4 (backfilled): standalone amenities multi-select. Pulls the
 * 21 default entries from `lib/schemas/amenity-taxonomy.DEFAULT_AMENITIES`
 * so the same source feeds both the property editor's grid (Sprint 7c)
 * and this search filter.
 *
 * Controlled component — the parent owns the selected set so the More-
 * Filters drawer can roll the values into its overall apply step.
 */
export function AmenitiesMultiSelect({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<string>;
  onToggle: (label: string) => void;
  onClear?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          Amenities · {selected.size} selected
        </span>
        {selected.size > 0 && onClear ? (
          <button
            type="button"
            onClick={onClear}
            // Unstyled text button: with no box of its own it is about as tall
            // as its 11.5px line box, so it fails the 44px check on both axes
            // even though the chips beside it now pass. h-11 + px-2 gives it a
            // thumb-sized box on a phone and `-me-2` cancels the padding at the
            // row's end edge, so the label stays flush with the chips below it
            // instead of stepping 8px inward. All three revert at `md`.
            className="inline-flex items-center h-11 px-2 -me-2 md:h-auto md:px-0 md:me-0 text-[11.5px] text-bz-muted hover:text-bz-ink-2 underline underline-offset-2"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_AMENITIES.map((a) => {
          const active = selected.has(a.label);
          return (
            <button
              key={a.code}
              type="button"
              onClick={() => onToggle(a.label)}
              aria-pressed={active}
              className={cn(
                // 44px tall on a phone (28px from `md` up). Hand-rolled
                // <button>s, so the data-slot `(pointer: coarse)` floor in
                // globals.css never reached them. px-4 rides along on the same
                // breakpoint because the short labels — "Gym", "Spa" — are
                // three characters at 11.5px and fail the *width* half of the
                // 44px check at px-2.5; the long ones ("Covered parking") were
                // always wide enough. Desktop keeps the dense 28px pill the
                // MoreFilters drawer was laid out around.
                "inline-flex items-center h-11 px-4 md:h-7 md:px-2.5 rounded-full text-[11.5px] transition-colors",
                active
                  ? "bg-bz-navy text-bz-bg"
                  : "border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong",
              )}
            >
              {a.label}
              {active ? <X size={10} strokeWidth={2} className="ms-1" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
