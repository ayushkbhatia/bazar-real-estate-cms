"use client";

/**
 * Home "Where to live" orchestrator. Owns the shared state (active
 * emirate, deferred-mount flag, selected area) and renders:
 *   · a segmented Abu Dhabi / Dubai toggle
 *   · a static teaser (no MapLibre) that defers the heavy map until the
 *     visitor clicks "Explore the map" — keeps the home page fast/static
 *   · the keyboard-accessible area chips
 *
 * All data arrives as serialisable props from the server section, so this
 * subtree does no per-request work and the page stays static / ISR.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { AreaMapLazy } from "./area-map-lazy";
import { AreaChips } from "./area-chips";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";

const EMIRATES: { slug: string; label: string }[] = [
  { slug: "abu-dhabi", label: "Abu Dhabi" },
  { slug: "dubai", label: "Dubai" },
];

export function AreaMapHome({
  areas,
  dots,
}: {
  areas: AreaPin[];
  dots: AreaDot[];
}) {
  const [emirate, setEmirate] = useState("abu-dhabi");
  const [live, setLive] = useState(false);
  const [focusSlug, setFocusSlug] = useState<string | null>(null);

  const visibleAreas = useMemo(
    () => areas.filter((a) => a.emirate === emirate),
    [areas, emirate],
  );
  const liveCount = useMemo(
    () => visibleAreas.reduce((n, a) => n + a.count, 0),
    [visibleAreas],
  );
  const emirateLabel =
    EMIRATES.find((e) => e.slug === emirate)?.label ?? "Abu Dhabi";

  // A chip click both unlocks the map and flies to the area.
  const onChipSelect = (slug: string) => {
    setLive(true);
    setFocusSlug(slug);
  };

  return (
    <section className="bg-bz-surface-2 px-4 py-12 md:px-12 md:py-20">
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
        {live ? (
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
          <Teaser
            count={liveCount}
            label={emirateLabel}
            onExplore={() => setLive(true)}
          />
        )}
      </div>

      <div className="mt-5">
        <AreaChips
          areas={visibleAreas}
          activeSlug={focusSlug}
          onSelect={onChipSelect}
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
                : "text-bz-muted hover:text-bz-ink-2",
            ].join(" ")}
          >
            {e.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Static teaser — a lightweight map-toned poster shown until "Explore".
// Deliberately contains NO MapLibre import so the engine + tiles only
// download once the visitor opts in.
// ─────────────────────────────────────────────────────────────────────
function Teaser({
  count,
  label,
  onExplore,
}: {
  count: number;
  label: string;
  onExplore: () => void;
}) {
  return (
    <div className="absolute inset-0">
      {/* Warm, map-like backdrop echoing the recoloured Positron palette. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 20% 15%, #f5f3ec 0%, #eef0e8 45%, #e3e7dc 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(75,90,76,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(75,90,76,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {count > 0 && (
        <div className="absolute left-4 top-4 inline-flex h-[30px] items-center gap-2 rounded-full bg-bz-surface/95 px-3 text-xs text-bz-ink-2 shadow-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-bz-accent" />
          {count} live listings · {label}
        </div>
      )}

      <div className="absolute inset-0 flex items-end justify-center pb-12">
        <button
          type="button"
          onClick={onExplore}
          className="inline-flex h-12 items-center gap-2 rounded-md bg-bz-ink px-6 text-sm font-medium text-bz-bg shadow-[0_12px_32px_rgba(20,18,12,0.28)] transition-colors hover:bg-bz-ink/90"
        >
          <MapIcon size={17} /> Explore the map
        </button>
      </div>
    </div>
  );
}
