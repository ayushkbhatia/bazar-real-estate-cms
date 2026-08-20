"use client";

/**
 * One area's projects, as a horizontal rail.
 *
 * The area groups under the New Projects map used to be open-ended grids: an
 * area with thirty published projects rendered thirty cards stacked three to a
 * row, and four such areas buried the rest of the page. A rail keeps every
 * area to a single row whatever its count — three cards on desktop, two on
 * tablet, one on a phone — and moves through them a viewport at a time.
 *
 * The cards themselves are rendered on the server and handed in as nodes:
 * `DevelopmentCard` reaches into server-only query code, so this island owns
 * the interaction and nothing else. See the note in offplan-map-explorer.tsx.
 */

import * as React from "react";
import Link from "@/components/i18n/link";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  clampInlineScroll,
  inlineScrollStart,
  maxInlineScroll,
  toScrollLeft,
} from "@/lib/dom/inline-scroll";
import { useIsRtl } from "@/lib/dom/use-is-rtl";

export type ProjectCarouselProps = {
  /** Area name, used as the group heading and the rail's accessible name. */
  name: string;
  /** Total published projects in this area — not the number of cards shown. */
  count: number;
  /** Server-rendered `DevelopmentCard`s, one node per project. */
  items: React.ReactNode[];
  /** Where "view all" points; omitted when the area has no search route. */
  viewAllHref?: string | null;
  viewAllLabel?: string | null;
};

export function ProjectCarousel({
  name,
  count,
  items,
  viewAllHref,
  viewAllLabel,
}: ProjectCarouselProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  // All three start false and are corrected on mount: before layout we don't
  // know whether the rail overflows, and rendering arrows that then vanish is
  // worse than rendering none that then appear.
  const [overflows, setOverflows] = React.useState(false);
  const rtl = useIsRtl();
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  const measure = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // A sub-pixel track width makes the end comparison flicker, hence the
    // one-pixel slack on both edges.
    const max = maxInlineScroll(el);
    // Logical position: 0 is the inline start in both directions. Read raw,
    // `scrollLeft` is <= 0 throughout in RTL, so `canPrev` would be pinned
    // false and `canNext` pinned true — the rail frozen with both arrows lit.
    const pos = inlineScrollStart(el, rtl);
    setOverflows(max > 1);
    setCanPrev(pos > 1);
    setCanNext(pos < max - 1);
  }, [rtl]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    measure();
    el.addEventListener("scroll", measure, { passive: true });

    // Column count changes at the breakpoints, so the rail can stop or start
    // overflowing without anything scrolling.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);

    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [items.length, measure]);

  /** One viewport of the rail — exactly three cards on desktop, one on a phone. */
  const page = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = inlineScrollStart(el, rtl);
    const max = maxInlineScroll(el);
    const target = clampInlineScroll(from + direction * el.clientWidth, max);
    if (target === from) return;

    el.scrollTo({
      left: toScrollLeft(target, rtl),
      behavior: reduced ? "auto" : "smooth",
    });
    if (reduced) {
      measure();
      return;
    }

    /*
     * Not every engine actually animates a smooth scroll — some embedded and
     * headless browsers accept the call and do nothing, which would leave
     * these arrows dead with no way to tell. A real smooth scroll has always
     * started moving by the time this fires, so "hasn't moved at all" means
     * the animation was never honoured: land it instantly rather than not at
     * all. Scroll snapping settles the final position either way.
     *
     * `measure` is called here rather than left to the scroll listener for the
     * same reason — an engine that skips the animation may skip the scroll
     * event with it, and then the arrows would enable and disable against a
     * position the rail left long ago.
     */
    window.setTimeout(() => {
      if (el.scrollLeft === toScrollLeft(from, rtl)) {
        el.scrollLeft = toScrollLeft(target, rtl);
      }
      measure();
    }, 150);
    // A smooth scroll is still moving when the check above runs; re-read once
    // it has had time to settle.
    window.setTimeout(measure, 500);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-bz-border pb-4">
        <MapPin size={16} strokeWidth={1.7} className="text-bz-accent" />
        <h3
          className="serif text-[22px] md:text-[26px]"
          style={{ letterSpacing: "-0.015em" }}
        >
          {name}
        </h3>
        <span className="mono text-[12px] text-bz-muted">
          {count} {count === 1 ? "project" : "projects"}
        </span>

        <div className="ms-auto flex items-center gap-2">
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1.5 text-[13px] text-bz-ink-2 transition-colors hover:text-bz-accent"
            >
              {viewAllLabel || `View all in ${name}`}
              <ArrowRight size={14} strokeWidth={1.7} />
            </Link>
          ) : null}

          {/*
            Arrows are a convenience over a rail that is already scrollable by
            touch, wheel and keyboard, so they only appear where they do
            something — and they stay out of the tab order, because tabbing
            through the cards scrolls the rail on its own.
          */}
          {overflows ? (
            <div className="flex items-center gap-2">
              <NavButton
                label={`Previous projects in ${name}`}
                disabled={!canPrev}
                onClick={() => page(-1)}
                testId={`carousel-prev-${name}`}
              >
                <ChevronLeft size={16} strokeWidth={1.8} />
              </NavButton>
              <NavButton
                label={`More projects in ${name}`}
                disabled={!canNext}
                onClick={() => page(1)}
                testId={`carousel-next-${name}`}
              >
                <ChevronRight size={16} strokeWidth={1.8} />
              </NavButton>
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={trackRef}
        role="group"
        aria-label={`Projects in ${name}`}
        data-testid={`carousel-track-${name}`}
        className={[
          // No `scroll-smooth` here: CSS `scroll-behavior` wins over the
          // `behavior` passed to scrollBy, so the class would quietly override
          // the instant scrolling the reduced-motion branch below asks for.
          // The arrows set the behaviour themselves instead.
          "flex gap-6 overflow-x-auto snap-x snap-mandatory",
          // The rail supplies its own affordances; a native bar under a row of
          // cards reads as a layout bug on desktop.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // 1-up, 2-up, then 3-up. The widths subtract the gaps the row spends
          // between cards, so three cards land flush with the container.
          "[&>*]:shrink-0 [&>*]:snap-start",
          "[&>*]:w-full sm:[&>*]:w-[calc((100%-1.5rem)/2)] lg:[&>*]:w-[calc((100%-3rem)/3)]",
        ].join(" ")}
      >
        {items.map((card, i) => (
          <div key={i}>{card}</div>
        ))}
      </div>
    </div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  testId,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-testid={testId}
      tabIndex={-1}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-bz-border text-bz-ink transition-colors hover:border-bz-ink disabled:cursor-default disabled:opacity-35 disabled:hover:border-bz-border"
    >
      {children}
    </button>
  );
}
