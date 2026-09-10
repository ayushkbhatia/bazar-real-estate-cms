"use client";

/**
 * A card grid on a desktop, a swipe rail on a phone.
 *
 * The master pages lay their card bands out as `grid-cols-1 sm:grid-cols-2
 * lg:grid-cols-3`, which on a phone is a single column — six development cards
 * came to 3,209px of the /off-plan page, a third of its whole height, and every
 * one of them had to be scrolled past to reach the section below. The same six
 * cards on a rail are one screen.
 *
 * Two details are the difference between a rail and a row that happens to
 * overflow:
 *
 *  - **The cards are 86% wide and the track bleeds to the page edge.** Part of
 *    the next card is always visible, which is the affordance itself — a row of
 *    cards that ends flush at the viewport edge reads as a list that ended.
 *  - **The arrows.** They are a second, explicit signal for the same thing, and
 *    the reason this component exists rather than a handful of utility classes
 *    on the caller's `div`. They only appear where the track actually
 *    overflows, and they stay out of the tab order, because tabbing through the
 *    cards scrolls the rail on its own.
 *
 * From `md` up the track is the grid it always was — `md:grid` wins over the
 * `flex` below it — so nothing about the desktop band changes.
 *
 * `ProjectCarousel` is the same idea with a heading, a count and a "view all"
 * link built in; it stays separate because that header is the map explorer's
 * area selector rather than a section head.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  clampInlineScroll,
  inlineScrollStart,
  maxInlineScroll,
  toScrollLeft,
} from "@/lib/dom/inline-scroll";
import { useIsRtl } from "@/lib/dom/use-is-rtl";

export type CardRailItem = {
  /** Stable identity — the record's id. */
  key: string;
  /** The server-rendered card. */
  node: React.ReactNode;
};

export function CardRail({
  items,
  label,
  columns = 3,
}: {
  items: CardRailItem[];
  /** Accessible name for the rail — the section's heading. */
  label: string;
  /** Desktop column count from `md` up. */
  columns?: 2 | 3;
}) {
  const t = useTranslations("common.rail");
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const rtl = useIsRtl();
  // All three start false and are corrected on mount: before layout we don't
  // know whether the track overflows, and arrows that then vanish are worse
  // than no arrows that then appear.
  const [overflows, setOverflows] = React.useState(false);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  const measure = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // Logical position: 0 is the inline start in both directions. Read raw,
    // `scrollLeft` is <= 0 throughout in RTL, so `canPrev` would be pinned
    // false and `canNext` pinned true — the rail frozen with both arrows lit.
    const max = maxInlineScroll(el);
    const pos = inlineScrollStart(el, rtl);
    // A sub-pixel track width makes the end comparison flicker, hence the
    // one-pixel slack on both edges.
    setOverflows(max > 1);
    setCanPrev(pos > 1);
    setCanNext(pos < max - 1);
  }, [rtl]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // The track stops being a rail at `md`, so it can stop or start
    // overflowing without anything having scrolled.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [items.length, measure]);

  /** One card, not one viewport — the next card is already half in view. */
  const page = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const stride = first ? first.offsetWidth + gapOf(el) : el.clientWidth;

    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = inlineScrollStart(el, rtl);
    const target = clampInlineScroll(
      from + direction * stride,
      maxInlineScroll(el),
    );
    if (target === from) return;

    el.scrollTo({
      left: toScrollLeft(target, rtl),
      behavior: reduced ? "auto" : "smooth",
    });
    // Not every engine honours a smooth scroll — some accept the call and do
    // nothing, which would leave these arrows dead with no way to tell. See
    // the longer note in project-carousel.tsx; same fallback, same reason.
    if (reduced) {
      measure();
      return;
    }
    window.setTimeout(() => {
      if (el.scrollLeft === toScrollLeft(from, rtl)) {
        el.scrollLeft = toScrollLeft(target, rtl);
      }
      measure();
    }, 150);
    window.setTimeout(measure, 500);
  };

  return (
    <div>
      {overflows ? (
        <div className="mb-4 flex items-center justify-end gap-2 md:hidden">
          <NavButton
            label={t("previous")}
            disabled={!canPrev}
            onClick={() => page(-1)}
            testId="card-rail-prev"
          >
            <ChevronLeft size={16} strokeWidth={1.8} />
          </NavButton>
          <NavButton
            label={t("next")}
            disabled={!canNext}
            onClick={() => page(1)}
            testId="card-rail-next"
          >
            <ChevronRight size={16} strokeWidth={1.8} />
          </NavButton>
        </div>
      ) : null}

      <div
        ref={trackRef}
        role="group"
        aria-label={label}
        data-testid="card-rail-track"
        className={[
          /*
           * No padding and no negative margin on the track, however tempting a
           * full-bleed rail is. Measured in Chromium: with `-mx-4 px-4` the
           * RTL track's scrollable range clamps at `scrollLeft: -16` rather
           * than 0, so `inlineScrollStart` reads 16 on a rail that is already
           * at its start and the "previous" arrow lights up with nothing
           * behind it. Giving the gutter back as a margin on the first and
           * last card does not help — the offset survives. The map rail on
           * this same page has always been a bare track for the same reason,
           * and rests at a true zero in both directions.
           *
           * The peek comes from the card width instead: 86% of the track means
           * the next card is always a sliver short of the section's gutter.
           */
          "flex snap-x snap-mandatory gap-4 overflow-x-auto",
          // No `scroll-smooth`: CSS `scroll-behavior` wins over the `behavior`
          // passed to `scrollTo`, so the class would quietly override the
          // instant scrolling the reduced-motion branch asks for.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[&>*]:w-[86%] [&>*]:shrink-0 [&>*]:snap-start",
          // From `md` it is the grid the band always was.
          "md:grid md:gap-6 md:overflow-visible",
          columns === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3",
          "md:[&>*]:w-auto",
        ].join(" ")}
      >
        {items.map((item) => (
          <div key={item.key}>{item.node}</div>
        ))}
      </div>
    </div>
  );
}

/** The `column-gap` the track is currently drawing, in px. */
function gapOf(el: HTMLElement): number {
  const gap = Number.parseFloat(getComputedStyle(el).columnGap);
  return Number.isFinite(gap) ? gap : 0;
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
      // 44px is the touch floor the mobile geometry gate holds every control
      // to; the visible disc stays 36px like the map rail's arrows, so the
      // extra 8px is padding rather than a bigger button.
      className="flex h-11 w-11 items-center justify-center rounded-full border border-bz-border text-bz-ink transition-colors hover:border-bz-ink disabled:cursor-default disabled:opacity-35 disabled:hover:border-bz-border"
    >
      {children}
    </button>
  );
}
