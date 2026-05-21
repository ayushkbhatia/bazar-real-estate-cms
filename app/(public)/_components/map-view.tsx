"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  formatPriceAED,
  propertyUrl,
} from "@/lib/queries/property-utils";

export type MapPin = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  price_aed: number;
  geo: { lat: number; lng: number };
};

type Props = {
  pins: MapPin[];
  className?: string;
};

// Default to Abu Dhabi if no pins (city centre, zoomed mid).
const DEFAULT_CENTER: [number, number] = [54.3773, 24.4539];

// OpenStreetMap raster tiles via the OSM project. Acceptable for dev +
// low-traffic UAT; swap to Mapbox / MapTiler / etc. once we have a real
// tile budget.
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export function MapView({ pins, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = pins.length
      ? [pins[0].geo.lng, pins[0].geo.lat]
      : DEFAULT_CENTER;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom: pins.length ? 10 : 9,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // We deliberately recreate the map only on mount; pin updates are
    // applied in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (pins.length === 0) return;

    pins.forEach((pin) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "h-7 px-2 rounded-full bg-[#1B1A17] text-white text-[12px] font-medium shadow-md whitespace-nowrap";
      el.textContent = formatPriceAED(pin.price_aed);
      el.setAttribute("aria-label", `${pin.title} — ${formatPriceAED(pin.price_aed)}`);

      const popup = new Popup({ offset: 16, closeButton: false }).setHTML(
        `<a href="${propertyUrl(pin)}" style="display:block;text-decoration:none;color:inherit;font-family:inherit;font-size:13px">
          <div style="font-weight:500;margin-bottom:2px">${escapeHtml(pin.title)}</div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#666">${escapeHtml(pin.reference)} · ${formatPriceAED(pin.price_aed)}</div>
        </a>`,
      );

      const marker = new Marker({ element: el })
        .setLngLat([pin.geo.lng, pin.geo.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Fit bounds to all pins.
    if (pins.length === 1) {
      map.flyTo({ center: [pins[0].geo.lng, pins[0].geo.lat], zoom: 13 });
    } else {
      const bounds = pins.reduce(
        (acc, p) => acc.extend([p.geo.lng, p.geo.lat]),
        new maplibregl.LngLatBounds(),
      );
      map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
    }
  }, [pins]);

  return <div ref={containerRef} className={className} />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}
