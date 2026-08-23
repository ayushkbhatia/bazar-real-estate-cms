"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ensureRtlTextPlugin,
  pastelMapStyle,
} from "../../../_components/map-style";
import { useIsRtl } from "@/lib/dom/use-is-rtl";

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
 *
 * The engine is fetched at run time, and only once the frame nears the
 * viewport. `maplibre-gl` 5.24 is 1.03 MB minified (276 KB gzipped) and this
 * section sits under the gallery, the facts table and the description — two
 * or three phone screens down, and most sessions never scroll that far. A
 * static import put every byte of it in the first-load JS of `/p/[slug]` and
 * both developments templates, three of the heaviest pages we ship.
 *
 * Same deferral `area-map-lazy.tsx` gets from `next/dynamic`, written inline
 * because this component *is* the map container and the callers style it:
 * every call site passes a `className` carrying the aspect ratio and border,
 * so the box is already its final size and nothing shifts when the engine
 * lands. That is also why there is no shimmer here — an empty bordered frame
 * is exactly what the page shows today while the style resolves.
 *
 * The stylesheet stays a static import: 10 KB gzipped against the engine's
 * 276, and splitting it too would mean moving the body into a second module.
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
  const rtl = useIsRtl();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  // `-80px`, matching area-map-home.tsx rather than a positive preload
  // margin: shrinking the root keeps the engine out of Lighthouse's static,
  // no-scroll page-load window, which is what that file's comment records
  // failing CI's 0.65 performance floor when the map mounted eagerly. A
  // visit that never scrolls to the location section pays nothing at all.
  useEffect(() => {
    const el = containerRef.current;
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
      { rootMargin: "-80px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !containerRef.current) return;
    let dead = false;
    let map: MapLibreMap | null = null;

    void (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (dead || !containerRef.current) return;

      // Register the shaping plugin before the style resolves. Without it
      // maplibre draws Arabic as isolated, unjoined, left-to-right
      // letterforms — worse than leaving the labels in English.
      if (rtl) void ensureRtlTextPlugin(maplibregl);
      const style = await pastelMapStyle(rtl ? "ar" : "en");
      if (dead || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [lng, lat],
        zoom: 13,
        attributionControl: { compact: true },
      });

      // Listing pin.
      new maplibregl.Marker({ color: "var(--bz-accent, #005777)" })
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
    })();

    return () => {
      dead = true;
      map?.remove();
    };
  }, [near, lat, lng, title, pois, rtl]);

  return <div ref={containerRef} className={className} dir="ltr" />;
}
