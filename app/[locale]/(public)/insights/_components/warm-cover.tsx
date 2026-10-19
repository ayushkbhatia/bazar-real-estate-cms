"use client";

import * as React from "react";
import type { CoverWarmup } from "./article-hero";

/**
 * Covers already requested this page view, by src. Holding the `Image` keeps
 * the request alive (a collected element may abort it) and stops a card that
 * scrolls in and out from asking twice.
 */
const warmed = new Map<string, HTMLImageElement>();

function warm(cover: CoverWarmup) {
  if (warmed.has(cover.src)) return;
  // A visitor who asked the browser to save data gets no speculative covers.
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (connection?.saveData) return;
  const img = new Image();
  img.decoding = "async";
  // `sizes` before `srcset`: setting srcset starts the selection, and it
  // has to see the same sizes the article page will hand it.
  if (cover.sizes) img.sizes = cover.sizes;
  if (cover.srcSet) img.srcset = cover.srcSet;
  img.src = cover.src;
  warmed.set(cover.src, img);
}

/**
 * An article card that fetches its article's cover once the card is on
 * screen, so the article opens with its cover already in the cache. Hovering
 * or focusing the card warms it straight away, in case the reader is faster
 * than the observer. Cards behind "Load more" are not rendered, so they warm
 * only once revealed.
 */
export function WarmCover({
  cover,
  className,
  children,
}: {
  cover: CoverWarmup | null;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!cover || !el || typeof IntersectionObserver === "undefined") return;
    let idle: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        // After the page's own images, not in competition with them.
        idle =
          typeof requestIdleCallback === "function"
            ? requestIdleCallback(() => warm(cover), { timeout: 2000 })
            : window.setTimeout(() => warm(cover), 200);
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (idle === undefined) return;
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [cover]);

  const now = cover ? () => warm(cover) : undefined;

  return (
    <article ref={ref} className={className} onPointerEnter={now} onFocus={now}>
      {children}
    </article>
  );
}
