"use client";

/**
 * New Projects "Explore on the map" section. Same shape as the home
 * "Where to live" map, but the dots are off-plan projects (not listings):
 * click a dot → the project's off-plan detail page. Clicking an area chip
 * flies the map to that area AND filters the projects listed below to it, so
 * the two controls stay in sync.
 *
 * The section renders ONE rail, not one per area. It used to stack a rail per
 * area, which made the section grow with the catalogue rather than with the
 * viewport — eleven communities came to ~8,700px, 28% of the page, and six of
 * those rails held a single card. The map and its chips were already an area
 * selector, so an area is now a filter over a single rail: the section's
 * height no longer moves when a project is published.
 *
 * Every card is in the DOM at all times — filtering hides the ones that don't
 * match rather than dropping them, so all the project links stay crawlable
 * and each card is server-rendered exactly once.
 *
 * The cards are rendered on the server (DevelopmentCard pulls in server-only
 * query code) and handed in as nodes — this island only owns the interaction
 * (map camera + chip filter), so nothing server-only leaks into the client
 * bundle. The MapLibre engine is lazy and only mounts once the frame nears the
 * viewport (it sits well below the fold), keeping it off the page's
 * first-paint / Lighthouse budget.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AreaMapLazy } from "../area-map/area-map-lazy";
import { AreaChips } from "../area-map/area-chips";
import { ProjectCarousel, type ProjectCarouselItem } from "./project-carousel";
import { fluid } from "../marketing/fluid";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";

/**
 * An area, as the rail's heading and "view all" link when it is the selection.
 * No cards here any more — they live in one flat `items` list, tagged by area.
 */
export type OffplanGroupView = {
  slug: string;
  name: string;
  /** Published projects in the area — may exceed the number of cards shown. */
  count: number;
  /** "View all" target for the area, when one resolves. */
  viewAllHref?: string | null;
  viewAllLabel?: string | null;
};

/** One project card, tagged with the area whose chip reveals it. */
export type OffplanRailCard = {
  /** The project's id — stable across filter changes. */
  key: string;
  areaSlug: string;
  /** The server-rendered `DevelopmentCard`. */
  node: React.ReactNode;
};

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
  cards,
  allLabel,
  allCount,
  allViewAllHref = null,
  allViewAllLabel = null,
  eyebrow = "On the map",
  heading = "Explore new projects across Abu Dhabi.",
  body = "Zoom into a community and tap a project to open its details — or pick an area below to filter the launches.",
}: {
  areas: AreaPin[];
  dots: AreaDot[];
  /** Area metadata, in the order the editor curated (or busiest-first). */
  groups: OffplanGroupView[];
  /** Every card on the rail, in area order, each tagged with its area. */
  cards: OffplanRailCard[];
  /** Rail heading while no area is selected, e.g. "Across Abu Dhabi". */
  allLabel: string;
  /** Published projects across every area on the map. */
  allCount: number;
  /** Where the unfiltered rail's "view all" points. */
  allViewAllHref?: string | null;
  allViewAllLabel?: string | null;
  /** Section eyebrow — editable from the /off-plan master page. */
  eyebrow?: string;
  /** Section heading. */
  heading?: string;
  /** Intro paragraph under the heading; omitted when blank. */
  body?: string | null;
}) {
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [frameRef, mapReady] = useNearViewport<HTMLDivElement>();

  // The rail's heading, count and link follow the selection; with nothing
  // selected it speaks for the whole map.
  const selected = useMemo(
    () => (focusSlug ? groups.find((g) => g.slug === focusSlug) ?? null : null),
    [groups, focusSlug],
  );

  const items: ProjectCarouselItem[] = useMemo(
    () =>
      cards.map((c) => ({
        key: c.key,
        node: c.node,
        hidden: focusSlug !== null && c.areaSlug !== focusSlug,
      })),
    [cards, focusSlug],
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
            countKind="project"
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
            // Underlined 13px text reads like prose, but it is the only way to
            // undo the chip filter on /off-plan — tapping the active chip again
            // also clears it, but nothing on screen says so. A bare text button
            // is ~18px tall, so `min-h-11` below md with `inline-flex
            // items-center` to keep the label centred in the taller box.
            // `md:min-h-0` is an exact restore, not a new desktop value: this
            // is a flex item of a row-direction container, where `min-height:
            // auto` already resolves to 0 on the cross axis.
            className="inline-flex min-h-11 items-center text-[13px] text-bz-ink-2 underline underline-offset-4 hover:text-bz-ink md:min-h-0"
          >
            Show all areas
          </button>
        ) : null}
      </div>

      {/* One rail for the whole section — the chips above choose what it shows */}
      {cards.length > 0 ? (
        <div className="mt-12 md:mt-14">
          <ProjectCarousel
            name={selected?.name ?? allLabel}
            count={selected?.count ?? allCount}
            items={items}
            viewAllHref={selected ? selected.viewAllHref : allViewAllHref}
            viewAllLabel={selected ? selected.viewAllLabel : allViewAllLabel}
            resetKey={focusSlug}
          />
        </div>
      ) : null}
    </section>
  );
}
