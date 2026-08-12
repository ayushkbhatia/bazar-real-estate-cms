"use client";

/**
 * New Projects "Explore on the map" section. Same shape as the home
 * "Where to live" map, but the dots are off-plan projects (not listings):
 * click a dot → the project's off-plan detail page. Clicking an area chip
 * flies the map to that area AND filters the project cards listed below to
 * it, so the two controls stay in sync.
 *
 * The project cards are rendered on the server (DevelopmentCard pulls in
 * server-only query code) and handed in as `cards` nodes per group — this
 * island only owns the interaction (map camera + chip filter), so nothing
 * server-only leaks into the client bundle. The MapLibre engine is lazy and
 * only mounts once the frame nears the viewport (it sits well below the
 * fold), keeping it off the page's first-paint / Lighthouse budget.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AreaMapLazy } from "../area-map/area-map-lazy";
import { AreaChips } from "../area-map/area-chips";
import { ProjectCarousel } from "./project-carousel";
import { fluid } from "../marketing/fluid";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";

export type OffplanGroupView = {
  slug: string;
  name: string;
  /** Published projects in the area — may exceed the number of cards shown. */
  count: number;
  /**
   * Server-rendered DevelopmentCards, one node per project. An array rather
   * than a single grid node because the rail has to lay the cards out itself:
   * it sizes each one to the column count and snaps between them.
   */
  cards: React.ReactNode[];
  /** "View all" target for the area, when one resolves. */
  viewAllHref?: string | null;
  viewAllLabel?: string | null;
};

const COUNT_NOUN = { singular: "project", plural: "projects" };
const dotHref = (d: AreaDot) => `/off-plan/${d.slug}`;

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

export function OffplanMapExplorer({
  areas,
  dots,
  groups,
  eyebrow = "On the map",
  heading = "Explore new projects across Abu Dhabi.",
  body = "Zoom into a community and tap a project to open its details — or pick an area below to filter the launches.",
}: {
  areas: AreaPin[];
  dots: AreaDot[];
  groups: OffplanGroupView[];
  /** Section eyebrow — editable from the /off-plan master page. */
  eyebrow?: string;
  /** Section heading. */
  heading?: string;
  /** Intro paragraph under the heading; omitted when blank. */
  body?: string | null;
}) {
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [frameRef, mapReady] = useNearViewport<HTMLDivElement>();

  const visibleGroups = useMemo(
    () => (focusSlug ? groups.filter((g) => g.slug === focusSlug) : groups),
    [groups, focusSlug],
  );

  // Chips toggle: clicking the active area again clears the filter.
  const onSelect = (slug: string) =>
    setFocusSlug((cur) => (cur === slug ? null : slug));

  return (
    <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
      <div className="mb-8 flex flex-col gap-5 md:mb-9 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2
            className="serif mt-3 font-normal text-bz-ink"
            style={{ fontSize: fluid(40), letterSpacing: "-0.025em", lineHeight: 1.04 }}
          >
            {heading}
          </h2>
          {body ? (
            <p className="mt-4 max-w-[52ch] text-[15px] md:text-[16px] text-bz-ink-2 leading-relaxed">
              {body}
            </p>
          ) : null}
        </div>
      </div>

      <div
        ref={frameRef}
        className="relative h-[440px] md:h-[560px] overflow-hidden rounded-xl border border-bz-border bg-bz-surface"
      >
        {mapReady ? (
          <AreaMapLazy
            areas={areas}
            dots={dots}
            emirate="abu-dhabi"
            focusSlug={focusSlug}
            onSelectArea={setFocusSlug}
            mode="explore"
            dotHref={dotHref}
            dotCtaLabel="View project"
            countNoun={COUNT_NOUN}
            className="absolute inset-0"
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-bz-surface-2" />
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <AreaChips areas={areas} activeSlug={focusSlug} onSelect={onSelect} />
        {focusSlug ? (
          <button
            type="button"
            onClick={() => setFocusSlug(null)}
            className="text-[13px] text-bz-ink-2 underline underline-offset-4 hover:text-bz-ink"
          >
            Show all areas
          </button>
        ) : null}
      </div>

      {/* Projects, grouped by area — one rail each, however many there are */}
      <div className="mt-12 md:mt-14 flex flex-col gap-12 md:gap-14">
        {visibleGroups.map((g) => (
          <ProjectCarousel
            key={g.slug}
            name={g.name}
            count={g.count}
            items={g.cards}
            viewAllHref={g.viewAllHref}
            viewAllLabel={g.viewAllLabel}
          />
        ))}
      </div>
    </section>
  );
}
