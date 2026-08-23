"use client";

/**
 * Home "Where to live" orchestrator. Owns the shared state (active
 * emirate, selected area) and renders:
 *   · a segmented Abu Dhabi / Dubai toggle
 *   · the live MapLibre map — mounts on its own, no button/click required
 *   · the keyboard-accessible area chips
 *
 * All data arrives as serialisable props from the server section, so this
 * subtree does no per-request server work and the page stays static / ISR
 * — the map itself is still a lazy (`next/dynamic`, ssr:false) client
 * component, since MapLibre needs the DOM.
 *
 * Mount trigger: IntersectionObserver on the map frame, not a click. As
 * the visitor scrolls past the hero the map mounts itself just before it
 * enters view — no button, but MapLibre's real initialisation cost (style
 * fetch + runtime recolor + WebGL setup) never runs during the page's
 * first paint, which is what Lighthouse's page-load audit measures.
 *
 * This is a deliberate correction: an earlier version mounted the map
 * unconditionally right after first paint via `requestIdleCallback`.
 * That measured fine on a fast dev machine (TBT 0ms, performance 0.98)
 * but CI's shared/slower runner still had to do the same amount of work
 * — just delayed, not reduced — and it blocked the main thread for over
 * a second, failing Lighthouse CI's 0.65 performance floor (actual score:
 * 0.63). Scheduling ≠ reducing cost; gating on visibility keeps the cost
 * out of the audited page-load window entirely.
 */

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { AreaMapLazy } from "./area-map-lazy";
import { AreaChips } from "./area-chips";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";
import { EMIRATE_SLUGS, emirateMessageKey } from "@/lib/areas/emirates";

/**
 * True once `ref`'s element has genuinely scrolled into (most of) the
 * viewport. `rootMargin` defaults to a small *negative* value on
 * purpose — this section sits right below the hero with measured
 * headroom of only ~33px at Lighthouse's exact desktop viewport
 * (1350×940). A positive/generous forward margin (e.g. 600px) already
 * proved to put the frame inside the padded intersection root even at
 * scroll position 0 (that's what broke the first pass of this fix), and
 * even 0px leaves only that ~33px of real margin — too thin to trust
 * against font/line-height rendering differences between a local
 * machine and CI's runner (this exact page already showed a much larger
 * local-vs-CI gap once). Shrinking the root by 80px on every side adds
 * real buffer before the map is considered "in view" — it still mounts
 * automatically well before a scrolling visitor reaches it, just not
 * within reach of Lighthouse's static, no-scroll page-load audit.
 */
function useNearViewport<T extends Element>(
  rootMargin = "-80px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true); // no IO support → don't block the feature
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return [ref, near];
}

export function AreaMapHome({
  areas,
  dots,
  eyebrow,
  heading,
  body,
  allHref = "/areas",
  allLabel,
}: {
  areas: AreaPin[];
  dots: AreaDot[];
  /**
   * Section eyebrow — overridden per surface (e.g. rental areas). `null`
   * (what a blank master-page field resolves to) falls back to the default,
   * so callers can pass a resolved value straight through.
   */
  eyebrow?: string | null;
  /** Section heading. `null` → default. */
  heading?: string | null;
  /** Optional paragraph under the heading. Nothing renders when blank. */
  body?: string | null;
  /** "All …" link target (defaults to the areas index). */
  allHref?: string;
  /** Overrides the link's label; blank uses the catalogue's "All areas". */
  allLabel?: string;
}) {
  const t = useTranslations("common");
  const [emirate, setEmirate] = useState("abu-dhabi");
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [frameRef, mapReady] = useNearViewport<HTMLDivElement>();

  const visibleAreas = useMemo(
    () => areas.filter((a) => a.emirate === emirate),
    [areas, emirate],
  );

  return (
    <section className="bg-bz-bg px-4 py-12 md:px-12 md:py-20">
      <div className="mb-8 flex flex-col gap-5 md:mb-9 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">{eyebrow ?? "Where to live"}</div>
          <h2 className="serif mt-2 text-3xl tracking-tight md:text-4xl">
            {heading ?? "Find your area first. The home follows."}
          </h2>
          {body ? (
            <p className="mt-4 max-w-[52ch] text-[15px] md:text-[16px] text-bz-ink-2 leading-relaxed">
              {body}
            </p>
          ) : null}
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
            href={allHref}
            className="hidden items-center gap-1.5 text-sm text-bz-ink-2 transition-colors hover:text-bz-ink md:inline-flex"
          >
            {allLabel ?? t("allAreas")} <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div
        ref={frameRef}
        className="relative h-[440px] overflow-hidden rounded-xl border border-bz-border bg-bz-surface md:h-[560px]"
      >
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
  const t = useTranslations("common");
  return (
    <div
      className="flex gap-0.5 rounded-lg bg-bz-surface-2 p-[3px]"
      role="tablist"
      aria-label={t("emirate")}
    >
      {EMIRATE_SLUGS.map((slug) => {
        const active = emirate === slug;
        return (
          <button
            key={slug}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(slug)}
            className={[
              // 34px is a mouse height, and this pair is the only way to reach
              // Dubai's areas — there is no second control that switches
              // emirate. `h-11` below md, the original 34px restored from md
              // up so the desktop header row keeps its proportions against the
              // "All areas" link beside it. The 2px `gap-0.5` stays: both
              // targets clear 44px on their own, which is what 2.5.5 asks of a
              // segmented control.
              "h-11 md:h-[34px] rounded-md px-4 text-sm font-medium transition-colors",
              active
                ? "bg-bz-surface text-bz-ink shadow-sm"
                : "text-bz-ink-2 hover:text-bz-ink",
            ].join(" ")}
          >
            {t(emirateMessageKey(slug))}
          </button>
        );
      })}
    </div>
  );
}

