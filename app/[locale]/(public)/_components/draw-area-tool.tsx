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
      {/* `pointer-coarse:min-h-11` is the WCAG 2.5.5 floor. Measured 102x32 at
          390px on a production build: wide enough, 12px short. Height is the
          only axis touched — the label sets the width, and "Cancel draw" (the
          active state) is the longer of the two strings, so the box never
          shrinks below what was measured.

          `pointer-coarse:` rather than `md:`, because the question is whether a
          thumb is doing the tapping and not whether the window is narrow — a
          touchscreen laptop wants the bigger target, a narrow desktop window
          does not. A mouse-driven desktop renders byte-identically.

          `min-h-` rather than `h-`: `h-8` and a coarse-pointer `h-11` are the
          same property at equal specificity (a media query adds none), so which
          one applies would come down to Tailwind's internal utility ordering.
          `min-height` clamps the used height either way — the same reasoning
          globals.css gives for the `[data-slot="button"]` floor, which does not
          reach this button because it is hand-rolled rather than the primitive. */}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 pointer-coarse:min-h-11 px-3 rounded-md border text-[12.5px] transition-colors",
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
          Polygon drawing lands with Mapbox in Sprint 12. The tool fires a draw
          event for downstream listeners today.
        </div>
      ) : null}
    </div>
  );
}
