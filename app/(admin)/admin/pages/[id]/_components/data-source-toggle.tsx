"use client";

import { cn } from "@/lib/utils";

const SOURCES = [
  { value: "manual", label: "Manual", desc: "Hand-pick entries" },
  { value: "auto_feed", label: "Auto-feed", desc: "Latest N" },
  { value: "tagged", label: "Tagged", desc: "By tag/category" },
] as const;

type Source = (typeof SOURCES)[number]["value"];

/**
 * Sprint 7g (backfilled): data-source toggle on blocks that surface
 * content lists (strip, grid, mosaic). Picks whether items come from
 * manual selection, an auto-feed (most-recent), or a tagged feed.
 */
export function DataSourceToggle({
  value,
  onChange,
}: {
  value: Source;
  onChange: (v: Source) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SOURCES.map((s) => {
        const active = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            aria-pressed={active}
            className={cn(
              "p-3 rounded-md border text-left transition-colors",
              active
                ? "border-bz-ink bg-bz-bg"
                : "border-bz-border bg-bz-bg hover:border-bz-border-strong",
            )}
          >
            <div className="text-[13px] text-bz-ink font-medium">
              {s.label}
            </div>
            <div className="text-[11.5px] text-bz-muted mt-0.5">{s.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
