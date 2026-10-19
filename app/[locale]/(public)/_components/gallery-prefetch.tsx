"use client";

import { useEffect, useRef } from "react";
import { getImageProps } from "next/image";
import {
  GALLERY_HERO_SIZES,
  GALLERY_TILE_SIZES,
} from "../p/[slug]/_components/gallery-sizes";

/**
 * Warms a listing page's gallery from its search-result card.
 *
 * Opening a listing used to show the page and then, a second or two later,
 * the photos: each gallery variant is resized on demand by the image
 * optimizer, and a cold one measured 0.8–2.2 s (`x-vercel-cache: MISS`). This
 * asks for those same variants while the card sits on screen, so the click
 * finds them in the browser cache (and the optimizer's), and the gallery
 * paints with the page.
 *
 * "The same variants" is the whole trick: a detached `<img>` given the
 * gallery's own `srcset` and `sizes` picks the same `w=` the gallery will, at
 * this viewport and pixel density, through the same `getImageProps` the
 * gallery's `<Image>` uses. Only a card that stays half in view for a moment
 * warms anything — a fast scroll past fetches nothing — and each URL at most
 * once per page load; pointing at or touching a card warms it straight away.
 * Data-saver and 2G connections are skipped.
 */
const DWELL_MS = 250;
const warmed = new Set<string>();

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

function constrained(): boolean {
  const connection = (navigator as { connection?: NetworkInformation })
    .connection;
  if (!connection) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g"
  );
}

function warm(urls: string[]) {
  urls.forEach((src, i) => {
    if (warmed.has(src)) return;
    warmed.add(src);
    const { props } = getImageProps({
      src,
      alt: "",
      fill: true,
      sizes: i === 0 ? GALLERY_HERO_SIZES : GALLERY_TILE_SIZES,
    });
    const img = new Image();
    img.decoding = "async";
    img.fetchPriority = "low";
    // `sizes` before `srcset`: the candidate is chosen when srcset lands.
    if (props.sizes) img.sizes = props.sizes;
    if (props.srcSet) img.srcset = props.srcSet;
    img.src = props.src;
  });
}

export function GalleryPrefetch({
  urls,
  children,
}: {
  /** The gallery's first photos, hero first, as public storage URLs. */
  urls: string[];
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = urls.join("|");

  useEffect(() => {
    const el = ref.current;
    if (!el || urls.length === 0 || typeof IntersectionObserver === "undefined")
      return;
    if (constrained()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          clearTimeout(timer);
          return;
        }
        timer = setTimeout(() => {
          observer.disconnect();
          const run = () => warm(urls);
          if (typeof requestIdleCallback === "function") {
            idle = requestIdleCallback(run, { timeout: 1500 });
          } else {
            run();
          }
        }, DWELL_MS);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      if (idle !== undefined && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idle);
      }
    };
    // `key` stands in for `urls`: a new array with the same photos is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Pointing at or touching a card is a stronger signal than seeing it: warm
  // at once, without the dwell, in case the click comes before the timer.
  const now = () => {
    if (urls.length > 0 && !constrained()) warm(urls);
  };

  return (
    <div ref={ref} onPointerEnter={now} onTouchStart={now} onFocus={now}>
      {children}
    </div>
  );
}
