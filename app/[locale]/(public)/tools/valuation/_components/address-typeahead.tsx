"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, MapPin } from "lucide-react";
import { env } from "@/lib/env";

const STATIC_PLACES = [
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

// Abu Dhabi-centroid bias for Mapbox proximity.
const AD_CENTER: [number, number] = [54.3667, 24.4667];

type Suggestion = { id: string; label: string };

/**
 * Sprint 12: live Mapbox forward geocoding biased to UAE; static
 * curated list as the fallback when NEXT_PUBLIC_MAPBOX_TOKEN is unset.
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
  const [remote, setRemote] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const mapboxConfigured = Boolean(env.NEXT_PUBLIC_MAPBOX_TOKEN);

  // Debounced live geocode when Mapbox is configured. All setState
  // calls happen inside async callbacks (after at least one microtask)
  // so React Compiler doesn't flag synchronous-set-in-effect.
  useEffect(() => {
    if (!mapboxConfigured) return;
    const q = value.trim();
    if (q.length < 3) {
      queueMicrotask(() => setRemote([]));
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          access_token: env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
          country: "ae",
          limit: "6",
          language: "en",
          types: "address,poi,neighborhood,place",
          proximity: `${AD_CENTER[0]},${AD_CENTER[1]}`,
        });
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`,
        );
        if (cancelled) return;
        if (res.ok) {
          const json = (await res.json()) as {
            features?: { id: string; place_name: string }[];
          };
          if (cancelled) return;
          setRemote(
            (json.features ?? []).map((f) => ({
              id: f.id,
              label: f.place_name,
            })),
          );
        } else {
          setRemote([]);
        }
      } catch {
        if (!cancelled) setRemote([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 240);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [value, mapboxConfigured]);

  const staticSuggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    return STATIC_PLACES.filter((p) => p.toLowerCase().includes(q))
      .slice(0, 6)
      .map((s) => ({ id: s, label: s }));
  }, [value]);

  const suggestions = mapboxConfigured ? remote : staticSuggestions;

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
        className="w-full h-10 pl-9 pr-3 rounded-md border border-bz-border bg-bz-bg text-[14px] outline-none focus:border-bz-accent"
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-10 top-[42px] left-0 right-0 max-h-[240px] overflow-y-auto rounded-md border border-bz-border bg-bz-bg shadow-md text-[13px]">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s.label);
                  setOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-bz-surface text-bz-ink-2 hover:text-bz-ink transition-colors"
              >
                <MapPin
                  size={12}
                  strokeWidth={1.7}
                  className="text-bz-muted flex-shrink-0"
                />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-[11px] text-bz-muted">
        {loading
          ? "Searching addresses…"
          : mapboxConfigured
            ? "Live geocoding via Mapbox · Abu Dhabi biased."
            : "Free-text — set NEXT_PUBLIC_MAPBOX_TOKEN for live geocoding."}
      </p>
    </div>
  );
}
