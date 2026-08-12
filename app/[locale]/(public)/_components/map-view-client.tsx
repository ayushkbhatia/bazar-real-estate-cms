"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "./map-view";

const MapView = dynamic(
  () => import("./map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-bz-surface-2 animate-pulse" />
    ),
  },
);

export function MapViewClient(props: { pins: MapPin[]; className?: string }) {
  return <MapView {...props} />;
}
