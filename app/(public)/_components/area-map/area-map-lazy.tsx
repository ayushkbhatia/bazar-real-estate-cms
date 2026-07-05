"use client";

/**
 * Lazy wrapper for the MapLibre area map. The engine + its CSS + the tile
 * bundle only download when this component actually mounts — which the
 * home teaser defers until the visitor clicks "Explore the map", keeping
 * the statically-rendered home page fast.
 */

import dynamic from "next/dynamic";
import type { AreaPin, AreaDot } from "@/lib/queries/area-map";

const AreaMap = dynamic(
  () => import("./area-map").then((m) => m.AreaMap),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 animate-pulse bg-bz-surface-2" />
    ),
  },
);

export function AreaMapLazy(props: {
  areas: AreaPin[];
  dots: AreaDot[];
  emirate: string;
  focusSlug?: string | null;
  onSelectArea?: (slug: string | null) => void;
  mode?: "explore" | "detail";
  centerSlug?: string;
  className?: string;
}) {
  return <AreaMap {...props} />;
}
