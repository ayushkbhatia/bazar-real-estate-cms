"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pastelMapStyle } from "../../../_components/map-style";

type Pin = {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  isPrimary?: boolean;
};

type Props = {
  pins: Pin[];
  className?: string;
};

/**
 * T1-C cleanup: "Future developments around this property" Mapbox view.
 *
 * Renders the current development as the primary pin (accent colour)
 * with up to 4 sibling-area developments as secondary pins (neutral).
 * Click any pin → popup with project name + link.
 *
 * Uses the shared Bazar pastel basemap (../../../_components/map-style) — the
 * same recoloured CARTO Positron style as the home + search maps.
 */
export function NearbyMap({ pins, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || pins.length === 0) return;
    let dead = false;
    let map: maplibregl.Map | null = null;

    const primary = pins.find((p) => p.isPrimary) ?? pins[0]!;

    pastelMapStyle().then((style) => {
      if (dead || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [primary.lng, primary.lat],
        zoom: 11,
        attributionControl: { compact: true },
      });

      // Add pins
      for (const pin of pins) {
        const marker = new maplibregl.Marker({
          color: pin.isPrimary ? "var(--bz-accent, #4B5A4C)" : "#7d8e7e",
        })
          .setLngLat([pin.lng, pin.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 18 }).setHTML(
              `<div style="font-family:system-ui;font-size:12.5px;color:#1B1A17;line-height:1.4;">
                <strong>${escapeHtml(pin.name)}</strong>
                ${
                  pin.isPrimary
                    ? '<br/><span style="color:#7d8e7e;font-size:10.5px;">This development</span>'
                    : `<br/><a href="/developments/${escapeHtml(pin.slug)}" style="color:#4B5A4C;font-size:11px;text-decoration:underline;">View project →</a>`
                }
              </div>`,
            ),
          )
          .addTo(map);
        if (pin.isPrimary) marker.togglePopup();
      }

      // Fit bounds to include every pin when there's more than one
      if (pins.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        for (const p of pins) bounds.extend([p.lng, p.lat]);
        map.fitBounds(bounds, { padding: 64, maxZoom: 13 });
      }
    });

    return () => {
      dead = true;
      map?.remove();
    };
  }, [pins]);

  return <div ref={containerRef} className={className} />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
