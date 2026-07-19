"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sprint 4 (backfilled): "Draw area" map tool. UI is wired today; the
 * actual polygon-drawing handler hooks into maplibre-gl-draw in Sprint
 * 12 alongside the Mapbox swap. For now the button toggles a hint
 * banner so the design surface is visible.
 */
export function DrawAreaTool({
  onPolygon,
}: {
  /** Sprint 12: called with the GeoJSON ring after a draw completes. */
  onPolygon?: (ring: [number, number][]) => void;
}) {
  const [active, setActive] = useState(false);

  function toggle() {
    if (active) {
      setActive(false);
      return;
    }
    setActive(true);
    // Until maplibre-gl-draw lands, fire a synthetic empty polygon so
    // downstream listeners can wire up their handlers.
    onPolygon?.([]);
  }

  return (
    <div className="inline-flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] transition-colors",
          active
            ? "bg-bz-navy text-bz-bg border-bz-navy"
            : "border-bz-border bg-bz-bg text-bz-ink-2 hover:border-bz-border-strong",
        )}
      >
        {active ? (
          <>
            <X size={13} strokeWidth={1.8} />
            Cancel draw
          </>
        ) : (
          <>
            <Pencil size={13} strokeWidth={1.7} />
            Draw area
          </>
        )}
      </button>
      {active ? (
        <div className="text-[11.5px] text-bz-muted max-w-[200px] leading-relaxed">
          Polygon drawing lands with Mapbox in Sprint 12. The tool fires a
          draw event for downstream listeners today.
        </div>
      ) : null}
    </div>
  );
}
