"use client";

/**
 * "Buy properties on the map" section for the /buy landing — the same
 * interactive MapLibre surface as the home "Where to live" map, but framed
 * for browsing homes for sale: each listing dot opens its property page
 * (the map's default dot behaviour). Abu Dhabi / Dubai toggle, lazy engine
 * that only mounts once the frame nears the viewport, and keyboard-
 * accessible area chips below.
 */

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { AreaMapLazy } from "../area-map/area-map-lazy";
import { AreaChips } from "../area-map/area-chips";
import { fluid } from "./fluid";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";
import { EMIRATE_SLUGS, emirateMessageKey } from "@/lib/areas/emirates";

/** True once `ref`'s element has scrolled to within `rootMargin` of view. */
function useNearViewport<T extends Element>(
  rootMargin = "-80px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
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

export function BuyPropertiesMap({
  areas,
  dots,
  eyebrow = "On the map",
  heading = "Buy across Abu Dhabi's communities.",
  body = "Zoom into an area and tap a property to open its details — or pick a community below to focus the map.",
  ctaHref = "/buy/search",
  ctaLabel = "Browse all for sale",
}: {
  areas: AreaPin[];
  dots: AreaDot[];
  /** Section eyebrow — editable from the /buy master page. */
  eyebrow?: string;
  /** Section heading. */
  heading?: string;
  /** Intro paragraph under the heading; omitted when blank. */
  body?: string | null;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const [emirate, setEmirate] = useState("abu-dhabi");
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [frameRef, mapReady] = useNearViewport<HTMLDivElement>();

  const visibleAreas = useMemo(
    () => areas.filter((a) => a.emirate === emirate),
    [areas, emirate],
  );

  return (
    <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
      <div className="mb-8 flex flex-col gap-5 md:mb-9 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2
            className="serif mt-3 font-normal text-bz-ink"
            style={{
              fontSize: fluid(40),
              letterSpacing: "-0.025em",
              lineHeight: 1.04,
            }}
          >
            {heading}
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
            href={ctaHref}
            className="hidden items-center gap-1.5 text-sm text-bz-ink-2 transition-colors hover:text-bz-ink md:inline-flex"
          >
            {ctaLabel} <ArrowRight size={14} />
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
          onSelect={(slug) =>
            setFocusSlug((cur) => (cur === slug ? null : slug))
          }
        />
      </div>
    </section>
  );
}

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
              "h-[34px] rounded-md px-4 text-sm font-medium transition-colors",
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
