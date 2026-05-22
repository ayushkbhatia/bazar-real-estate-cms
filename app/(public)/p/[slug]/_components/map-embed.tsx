"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type POI = {
  label: string;
  lat: number;
  lng: number;
  kind: "school" | "mall" | "beach" | "park" | "hospital" | "transit";
};

/**
 * Sprint 4c (backfilled): maplibre-gl embed on the property detail page.
 * Renders the listing's pin centred + optional POI pins around it.
 *
 * Sprint 12 swaps the open-source OSM tiles for Mapbox tiles + adds
 * Mapbox Geocoding for richer POI lookups.
 */
export function MapEmbed({
  lat,
  lng,
  title,
  pois,
  className,
}: {
  lat: number;
  lng: number;
  title: string;
  pois?: POI[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style:
        "https://api.maptiler.com/maps/dataviz-light/style.json?key=open",
      // Use OSM raster fallback if MapTiler open style fails. We try
      // OSM raster directly since it's the most portable + zero-key.
      center: [lng, lat],
      zoom: 13,
      attributionControl: { compact: true },
    });

    // Fall back to OSM raster if the styled source 404s.
    map.on("error", (e: unknown) => {
      // Best-effort: swap to OSM raster on any tile error.
      try {
        const err = e as { error?: { message?: string } };
        if (err.error?.message?.includes("404")) {
          map.setStyle({
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: [
                  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                ],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [
              { id: "osm", type: "raster", source: "osm" },
            ],
          });
        }
      } catch {
        /* swallow */
      }
    });

    // Listing pin.
    new maplibregl.Marker({ color: "var(--bz-accent, #4a6c4a)" })
      .setLngLat([lng, lat])
      .setPopup(
        new maplibregl.Popup({ offset: 18 }).setHTML(
          `<div style="font-family:system-ui;font-size:12px;color:#1a1a1a;">${title}</div>`,
        ),
      )
      .addTo(map);

    // Optional POI pins.
    for (const poi of pois ?? []) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:22px;height:22px;border-radius:50%;background:#fff;border:1.5px solid #999;display:flex;align-items:center;justify-content:center;font-size:10px;color:#444;font-family:system-ui;";
      el.textContent = poi.kind[0].toUpperCase();
      new maplibregl.Marker({ element: el })
        .setLngLat([poi.lng, poi.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 14 }).setHTML(
            `<div style="font-family:system-ui;font-size:11.5px;color:#1a1a1a;"><strong>${poi.label}</strong><br/><span style="color:#666;">${poi.kind}</span></div>`,
          ),
        )
        .addTo(map);
    }

    return () => {
      map.remove();
    };
  }, [lat, lng, title, pois]);

  return <div ref={containerRef} className={className} />;
}
