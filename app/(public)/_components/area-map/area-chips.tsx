"use client";

/**
 * Keyboard-accessible area chips — the non-canvas path to every area.
 * MapLibre pins live in a <canvas> and aren't tab-reachable, so these
 * chips carry the same click handlers and double as the mobile control.
 */

import type { AreaPin } from "@/lib/queries/area-map";

export function AreaChips({
  areas,
  activeSlug,
  onSelect,
}: {
  areas: AreaPin[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  if (areas.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-2"
      role="list"
      aria-label="Areas"
    >
      {areas.map((a) => {
        const active = a.slug === activeSlug;
        return (
          <button
            key={a.id}
            type="button"
            role="listitem"
            aria-pressed={active}
            onClick={() => onSelect(a.slug)}
            className={[
              "inline-flex h-[38px] items-center gap-2 rounded-full border px-4 text-sm transition-colors",
              active
                ? "border-bz-ink bg-bz-ink text-bz-bg"
                : "border-bz-border-strong bg-bz-surface text-bz-ink-2 hover:bg-bz-surface-2",
            ].join(" ")}
          >
            {a.name}
            <span className="mono text-[10.5px] opacity-65">{a.count}</span>
          </button>
        );
      })}
    </div>
  );
}
