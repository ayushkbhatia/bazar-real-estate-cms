"use client";

import { cn } from "@/lib/utils";
import { DEFAULT_AMENITIES } from "@/lib/schemas/amenity-taxonomy";

/**
 * Sprint 7c (backfilled): 21-toggle amenities grid. Replaces the
 * free-text chip list on the property edit form. Pulls the taxonomy
 * from `lib/schemas/amenity-taxonomy.DEFAULT_AMENITIES` (Sprint 8 swaps
 * this to a live read from the `amenities_taxonomy` table).
 */
export function AmenitiesGrid({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(label: string) {
    if (value.includes(label)) {
      onChange(value.filter((v) => v !== label));
    } else {
      onChange([...value, label]);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {DEFAULT_AMENITIES.map((a) => {
          const active = value.includes(a.label);
          return (
            <button
              key={a.code}
              type="button"
              onClick={() => toggle(a.label)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border text-[13px] transition-colors text-left",
                active
                  ? "border-bz-navy bg-bz-navy text-bz-bg"
                  : "border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong",
              )}
            >
              <span
                className={cn(
                  "inline-block w-3 h-3 rounded-sm flex-shrink-0",
                  active ? "bg-bz-accent-soft" : "bg-bz-surface-2",
                )}
              />
              {a.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11.5px] text-bz-muted">
        Taxonomy edits via Settings → Property fields (Sprint 8 ships the
        amenities_taxonomy table + editor).
      </p>
    </div>
  );
}
