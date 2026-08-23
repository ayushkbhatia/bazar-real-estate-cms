"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ensureRtlTextPlugin, pastelMapStyle } from "../../_components/map-style";
import { useIsRtl } from "@/lib/dom/use-is-rtl";

/**
 * Client MapLibre canvas for the contact HQ map — the shared Bazar pastel
 * basemap (recoloured CARTO Positron) with a single accent marker on the
 * HQ. Replaces the old OpenStreetMap iframe so this map matches the home,
 * search and listing maps.
 *
 * The engine loads at run time, and only once the frame nears the viewport.
 * This map is decorative on both of its call sites — it sits under the whole
 * contact form on `/contact` and inside the last band of `/about` — yet a
 * static import made maplibre-gl (1.03 MB minified, 276 KB gzipped) part of
 * the first-load JS on two pages a phone reaches with an address in mind and
 * a "Get directions" link already on screen above the map. Same deferral
 * `area-map-lazy.tsx` gets from `next/dynamic`, written inline because this
 * component *is* the container: both callers pass a `className` carrying the
 * aspect ratio and border, so the box is its final size before the engine
 * arrives and nothing shifts when it does.
 *
 * The stylesheet stays a static import: 10 KB gzipped against the engine's
 * 276, and splitting it too would mean moving the body into a second module.
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
  const rtl = useIsRtl();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  // `-80px`, matching area-map-home.tsx rather than a positive preload
  // margin: shrinking the root keeps the engine out of Lighthouse's static,
  // no-scroll page-load window, which is what that file's comment records
  // failing CI's 0.65 performance floor when the map mounted eagerly. A
  // visitor who reads the address and taps "Get directions" without
  // scrolling past it downloads none of this.
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
    const container = containerRef.current;
    if (!near || !container) return;
    let dead = false;
    let map: MapLibreMap | null = null;
    let ro: ResizeObserver | null = null;

    void (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (dead) return;

      // Register the shaping plugin before the style resolves. Without it
      // maplibre draws Arabic as isolated, unjoined, left-to-right
      // letterforms — worse than leaving the labels in English.
      if (rtl) void ensureRtlTextPlugin(maplibregl);
      const style = await pastelMapStyle(rtl ? "ar" : "en");
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
    })();

    return () => {
      dead = true;
      ro?.disconnect();
      map?.remove();
    };
  }, [near, lat, lng, label, rtl]);

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
