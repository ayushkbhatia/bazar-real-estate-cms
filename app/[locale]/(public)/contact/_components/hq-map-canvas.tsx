"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pastelMapStyle } from "../../_components/map-style";

/**
 * Client MapLibre canvas for the contact HQ map — the shared Bazar pastel
 * basemap (recoloured CARTO Positron) with a single accent marker on the
 * HQ. Replaces the old OpenStreetMap iframe so this map matches the home,
 * search and listing maps.
 */
export function HqMapCanvas({
  lat,
  lng,
  label,
  className,
}: {
  lat: number;
  lng: number;
  label: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let dead = false;
    let map: maplibregl.Map | null = null;
    let ro: ResizeObserver | null = null;

    pastelMapStyle().then((style) => {
      if (dead) return;
      const m = new maplibregl.Map({
        container,
        style,
        center: [lng, lat],
        zoom: 14,
        attributionControl: { compact: true },
        // A single-location map inside a scrolling page — require an explicit
        // gesture to zoom so the page still scrolls over it.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map = m;
      m.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      new maplibregl.Marker({ color: "var(--bz-accent, #005777)" })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 18 }).setHTML(
            `<div style="font-family:system-ui;font-size:12px;color:#1a1a1a;">${escapeHtml(label)}</div>`,
          ),
        )
        .addTo(m);

      // The container is sized via CSS aspect-ratio, whose resolved height may
      // not be readable at the exact tick MapLibre measures it — leaving the
      // canvas at its 400×300 default. Re-measure on the next frame and keep
      // tracking size via a ResizeObserver so it fills the container.
      requestAnimationFrame(() => m.resize());
      ro = new ResizeObserver(() => m.resize());
      ro.observe(container);
    });

    return () => {
      dead = true;
      ro?.disconnect();
      map?.remove();
    };
  }, [lat, lng, label]);

  return <div ref={containerRef} className={className} dir="ltr" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
