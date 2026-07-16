"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pastelMapStyle } from "../../../_components/map-style";

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
 * Uses the shared Bazar pastel basemap (../../../_components/map-style) — the
 * same recoloured CARTO Positron style as the home + search maps.
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
    let dead = false;
    let map: maplibregl.Map | null = null;

    pastelMapStyle().then((style) => {
      if (dead || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [lng, lat],
        zoom: 13,
        attributionControl: { compact: true },
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
    });

    return () => {
      dead = true;
      map?.remove();
    };
  }, [lat, lng, title, pois]);

  return <div ref={containerRef} className={className} />;
}
