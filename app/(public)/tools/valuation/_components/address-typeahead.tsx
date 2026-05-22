"use client";

import { useState, useMemo } from "react";
import { Search, MapPin } from "lucide-react";

const PLACES = [
  "Mamsha Al Saadiyat, Saadiyat Island",
  "Hidd Al Saadiyat, Saadiyat Island",
  "Nudra, Saadiyat Island",
  "Yas Acres, Yas Island",
  "Mayan, Yas Island",
  "Sun & Sky Towers, Al Reem Island",
  "Reflection, Al Reem Island",
  "Marina Square, Al Reem Island",
  "Al Raha Gardens, Al Raha",
  "Al Raha Beach, Al Raha",
  "Etihad Towers, Corniche",
  "Marina Mall residences, Corniche",
];

/**
 * Sprint 5b (backfilled): address typeahead for the valuation wizard.
 * Sprint 12 wires Mapbox Geocoding; today this uses a static curated
 * list of common Abu Dhabi addresses so the field is functional.
 */
export function AddressTypeahead({
  value,
  onChange,
  placeholder = "Building, community, or street",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    return PLACES.filter((p) => p.toLowerCase().includes(q)).slice(0, 6);
  }, [value]);

  return (
    <div className="relative">
      <Search
        size={14}
        strokeWidth={1.7}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
      />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-full h-10 pl-9 pr-3 rounded-md border border-bz-border bg-bz-bg text-[14px] outline-none focus:border-bz-border-strong"
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-10 top-[42px] left-0 right-0 max-h-[240px] overflow-y-auto rounded-md border border-bz-border bg-bz-bg shadow-md text-[13px]">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s);
                  setOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-bz-surface text-bz-ink-2 hover:text-bz-ink transition-colors"
              >
                <MapPin
                  size={12}
                  strokeWidth={1.7}
                  className="text-bz-muted flex-shrink-0"
                />
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-[11px] text-bz-muted">
        Live geocoding via Mapbox activates Sprint 12.
      </p>
    </div>
  );
}
