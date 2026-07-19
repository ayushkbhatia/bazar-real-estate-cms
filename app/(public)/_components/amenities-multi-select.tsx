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
            className="text-[11.5px] text-bz-muted hover:text-bz-ink-2 underline underline-offset-2"
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
                "inline-flex items-center h-7 px-2.5 rounded-full text-[11.5px] transition-colors",
                active
                  ? "bg-bz-navy text-bz-bg"
                  : "border border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong",
              )}
            >
              {a.label}
              {active ? (
                <X size={10} strokeWidth={2} className="ml-1" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
