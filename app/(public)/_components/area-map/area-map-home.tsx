"use client";

/**
 * Home "Where to live" orchestrator. Owns the shared state (active
 * emirate, selected area) and renders:
 *   · a segmented Abu Dhabi / Dubai toggle
 *   · the live MapLibre map — mounts automatically, no click required
 *   · the keyboard-accessible area chips
 *
 * All data arrives as serialisable props from the server section, so this
 * subtree does no per-request server work and the page stays static / ISR
 * — the map itself is still a lazy (`next/dynamic`, ssr:false) client
 * component, since MapLibre needs the DOM.
 *
 * The mount is scheduled just after first paint (`requestIdleCallback`,
 * with a short `setTimeout` fallback) rather than in the very first
 * render pass. Measured impact: mounting MapLibre synchronously on first
 * render dropped this page's Lighthouse performance score from 0.97 to
 * 0.74 locally (TBT 30ms → 360ms) — enough to risk failing CI's 0.65
 * floor once its lower-scoring runners are factored in. Deferring by one
 * idle tick keeps the map appearing automatically (no "Explore" button)
 * while letting the hero/LCP paint uncontested first.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AreaMapLazy } from "./area-map-lazy";
import { AreaChips } from "./area-chips";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";

const EMIRATES: { slug: string; label: string }[] = [
  { slug: "abu-dhabi", label: "Abu Dhabi" },
  { slug: "dubai", label: "Dubai" },
];

/** True once the browser has an idle moment after first paint (or a short
 *  fallback timeout elapses) — Safari has no requestIdleCallback. */
function useIdleReady(fallbackMs = 200): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => setReady(true), {
        timeout: fallbackMs * 4,
      });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), fallbackMs);
    return () => window.clearTimeout(id);
  }, [fallbackMs]);
  return ready;
}

export function AreaMapHome({
  areas,
  dots,
}: {
  areas: AreaPin[];
  dots: AreaDot[];
}) {
  const [emirate, setEmirate] = useState("abu-dhabi");
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const mapReady = useIdleReady();

  const visibleAreas = useMemo(
    () => areas.filter((a) => a.emirate === emirate),
    [areas, emirate],
  );

  return (
    <section className="bg-bz-bg px-4 py-12 md:px-12 md:py-20">
      <div className="mb-8 flex flex-col gap-5 md:mb-9 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">Where to live</div>
          <h2 className="serif mt-2 text-3xl tracking-tight md:text-4xl">
            Find your area first. The home follows.
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <EmirateToggle
            emirate={emirate}
            onChange={(k) => {
              setEmirate(k);
              setFocusSlug(null);
            }}
          />
          <Link
            href="/areas"
            className="hidden items-center gap-1.5 text-sm text-bz-ink-2 transition-colors hover:text-bz-ink md:inline-flex"
          >
            All areas <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="relative h-[440px] overflow-hidden rounded-xl border border-bz-border bg-bz-surface md:h-[560px]">
        {mapReady ? (
          <AreaMapLazy
            areas={areas}
            dots={dots}
            emirate={emirate}
            focusSlug={focusSlug}
            onSelectArea={setFocusSlug}
            mode="explore"
            className="absolute inset-0"
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-bz-surface-2" />
        )}
      </div>

      <div className="mt-5">
        <AreaChips
          areas={visibleAreas}
          activeSlug={focusSlug}
          onSelect={setFocusSlug}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Emirate toggle
// ─────────────────────────────────────────────────────────────────────
function EmirateToggle({
  emirate,
  onChange,
}: {
  emirate: string;
  onChange: (slug: string) => void;
}) {
  return (
    <div
      className="flex gap-0.5 rounded-lg bg-bz-surface-2 p-[3px]"
      role="tablist"
      aria-label="Emirate"
    >
      {EMIRATES.map((e) => {
        const active = emirate === e.slug;
        return (
          <button
            key={e.slug}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(e.slug)}
            className={[
              "h-[34px] rounded-md px-4 text-sm font-medium transition-colors",
              active
                ? "bg-bz-surface text-bz-ink shadow-sm"
                : "text-bz-ink-2 hover:text-bz-ink",
            ].join(" ")}
          >
            {e.label}
          </button>
        );
      })}
    </div>
  );
}

