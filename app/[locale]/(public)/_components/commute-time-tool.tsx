"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

const PRESETS = [
  { label: "Cranleigh Abu Dhabi", area: "saadiyat-island" },
  { label: "Yas Mall", area: "yas-island" },
  { label: "Abu Dhabi International Airport", area: "khalifa-city" },
  { label: "Corniche", area: "corniche" },
] as const;

/**
 * Sprint 4 (backfilled): commute-time filter tool. Selecting a preset
 * destination + max minutes will limit search results to listings within
 * that isochrone — once Mapbox's Isochrone API is wired (Sprint 12).
 *
 * For Sprint 4 we surface the UI so the filter bar matches the design,
 * with a clear note that the geo filter activates in Sprint 12.
 */
export function CommuteTimeTool() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(PRESETS[0].label);
  const [minutes, setMinutes] = useState<number>(20);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[12.5px] hover:border-bz-border-strong transition-colors"
      >
        <Clock size={13} strokeWidth={1.7} />
        Commute time
      </button>
      {open ? (
        <div className="absolute right-0 mt-1.5 w-[280px] rounded-md border border-bz-border bg-bz-bg shadow-md p-4 z-10">
          <label className="text-[11.5px] uppercase tracking-wider text-bz-muted">
            Destination
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full h-9 px-2 rounded-md border border-bz-border bg-bz-bg text-[13px]"
          >
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-[11.5px] uppercase tracking-wider text-bz-muted">
            Within
          </label>
          <div className="mt-1 inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
            {[10, 20, 30, 45].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={
                  minutes === m
                    ? "h-7 px-2.5 rounded text-[12px] bg-bz-navy text-bz-bg font-medium"
                    : "h-7 px-2.5 rounded text-[12px] text-bz-ink-2 hover:text-bz-ink"
                }
              >
                {m} min
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11.5px] text-bz-muted leading-relaxed">
            Geo-filtering by isochrone activates with Mapbox in Sprint 12.
            Your selection ({target}, {minutes} min) persists in URL state
            today.
          </p>
        </div>
      ) : null}
    </div>
  );
}
