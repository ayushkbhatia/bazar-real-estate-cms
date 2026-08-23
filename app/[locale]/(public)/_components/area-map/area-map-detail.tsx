"use client";

/**
 * Area-detail map band. Frames the camera on the current area (via
 * `centerSlug`) with its listing dots visible, but starts with no flyout
 * open — the summary card for the area you're already reading would be
 * redundant. Clicking a neighbouring pin still opens its flyout (with a
 * working "View area guide" link) and the "Back to city view" control
 * pulls back to the emirate overview.
 *
 * `AreaMapLazy` only puts the engine in its own chunk — the fetch still
 * starts the instant this component mounts, which on an area guide means at
 * page load, for a band that sits several phone screens below the fold
 * behind the guide's long-form sections. So the mount waits for the frame to
 * near the viewport, the same gate the home teaser and the /buy map already
 * use (area-map-home.tsx, buy-properties-map.tsx). A guide read to the third
 * paragraph and closed now costs none of maplibre's 1.03 MB.
 */

import { useEffect, useRef, useState } from "react";
import { AreaMapLazy } from "./area-map-lazy";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";

/** True once `ref`'s element has scrolled to within `rootMargin` of view. */
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

export function AreaMapDetail({
  areas,
  dots,
  areaSlug,
}: {
  areas: AreaPin[];
  dots: AreaDot[];
  areaSlug: string;
}) {
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [frameRef, mapReady] = useNearViewport<HTMLDivElement>();

  // The observed frame is `absolute inset-0` rather than a wrapper of its
  // own: the caller's band is the positioned box and already carries the
  // height, radius and border, so this fills it exactly and the placeholder
  // occupies the same rectangle the map will — no shift either way.
  return (
    <div ref={frameRef} className="absolute inset-0">
      {mapReady ? (
        <AreaMapLazy
          areas={areas}
          dots={dots}
          emirate="abu-dhabi"
          centerSlug={areaSlug}
          focusSlug={focusSlug}
          onSelectArea={setFocusSlug}
          mode="detail"
          className="absolute inset-0"
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-bz-surface-2" />
      )}
    </div>
  );
}
