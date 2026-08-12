"use client";

/**
 * Area-detail map band. Frames the camera on the current area (via
 * `centerSlug`) with its listing dots visible, but starts with no flyout
 * open — the summary card for the area you're already reading would be
 * redundant. Clicking a neighbouring pin still opens its flyout (with a
 * working "View area guide" link) and the "Back to city view" control
 * pulls back to the emirate overview.
 */

import { useState } from "react";
import { AreaMapLazy } from "./area-map-lazy";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";

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
  return (
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
  );
}
