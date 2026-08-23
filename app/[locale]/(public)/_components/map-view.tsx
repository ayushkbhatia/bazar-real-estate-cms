"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  Marker,
  Popup,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { propertyUrl } from "@/lib/queries/property-utils";
import { formatPrice, usePreferences } from "@/lib/preferences";
import { ensureRtlTextPlugin, pastelMapStyle } from "./map-style";
import { useIsRtl } from "@/lib/dom/use-is-rtl";

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

/**
 * 44px zoom buttons on a thumb. This map draws MapLibre's own
 * `NavigationControl` (not the hand-rolled `.bzmap__ctrls` markup the area map
 * uses), so the 44px mobile rule globals.css gives `.bzmap__ctrls button` never
 * reaches it — maplibre-gl.css pins `.maplibregl-ctrl-group button` to 29x29.
 * With `cooperativeGestures` on (see the map constructor below) these buttons
 * are the only one-finger way to zoom, so 29px is not good enough.
 *
 * Two things about the shape of the override:
 *
 *   · `!` — maplibre-gl.css is imported straight out of node_modules and is
 *     therefore unlayered, while Tailwind v4 emits every utility inside
 *     `@layer utilities`. An unlayered normal declaration out-cascades a
 *     layered one whatever the specificity, so nothing but an important
 *     declaration wins. Same cascade reasoning as the unlayered blocks in
 *     globals.css, applied from a call site instead.
 *   · `pointer-coarse:` rather than the usual "mobile value, `md:` restore"
 *     pair, because there is no honest restore to write: `size-auto` is not
 *     29px, and hard-coding the library's constant rots the day it changes.
 *     Scoping to coarse pointers leaves the mouse path untouched by
 *     construction.
 *
 * The glyph does not grow with the box — the icon is a background-image whose
 * SVG carries `width='29' height='29'`, so `background-size: auto` holds it at
 * 29px and maplibre's `background-position: 50%` centres it in the 44px button.
 */
const CTRL_TOUCH_TARGET =
  "pointer-coarse:[&_.maplibregl-ctrl-group_button]:size-11!";

export function MapView({ pins, className }: Props) {
  const rtl = useIsRtl();
  const { prefs } = usePreferences();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  // The pastel style is fetched async; flip this once the map exists so the
  // marker effect below (which reads mapRef) knows to re-run.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let dead = false;
    let map: MapLibreMap | null = null;

    const center: [number, number] = pins.length
      ? [pins[0].geo.lng, pins[0].geo.lat]
      : DEFAULT_CENTER;

    // Register the shaping plugin before the style resolves. Without it
    // maplibre draws Arabic as isolated, unjoined, left-to-right
    // letterforms — worse than leaving the labels in English.
    if (rtl) void ensureRtlTextPlugin(maplibregl);
    pastelMapStyle(rtl ? "ar" : "en").then((style) => {
      if (dead || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center,
        zoom: pins.length ? 10 : 9,
        attributionControl: false,
        // Without this the canvas claims every one-finger drag that starts on
        // it, and the map view is `h-[70vh]` on a phone — a thumb that lands
        // anywhere in the top two-thirds of the screen pans the map instead of
        // scrolling, so the pagination below it is unreachable. With it the
        // canvas takes `touch-action: pan-x pan-y`, the page scrolls, and two
        // fingers (or ctrl+wheel) still pan and zoom. The area map and the
        // contact HQ map have set it since they shipped; this one was missed.
        cooperativeGestures: true,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      dead = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
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
      const label = formatPrice(pin.price_aed, prefs);
      const el = document.createElement("button");
      el.type = "button";
      // 28px painted (`h-7`) is a mouse target, and in map view these pills are
      // the only route from the map into a listing. The painted pill stays 28px
      // on purpose — 44px price tags at phone map density cover the map they
      // annotate — and a transparent `::after` with -8px block insets carries
      // the hit area to 28 + 2×8 = 44px instead. Verified in Chromium by
      // walking `document.elementFromPoint` down the pill's centre line: 28
      // consecutive hits on the button before, 44 after.
      //
      // Only the block axis needs it. `formatPrice` compacts to "AED 2.4M",
      // which with `px-2` measures ~70px — already past 44 on the inline axis.
      //
      // No `relative` to go with the `absolute`: maplibre-gl.css sets
      // `.maplibregl-marker { position: absolute }` on this very element, which
      // is containing block enough for the pseudo — and being unlayered, it
      // would beat a Tailwind `relative` anyway.
      el.className =
        "h-7 px-2 rounded-full bg-bz-navy hover:bg-bz-teal transition-colors text-white text-[12px] font-medium shadow-md whitespace-nowrap pointer-coarse:after:absolute pointer-coarse:after:content-[''] pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2";
      el.textContent = label;
      el.setAttribute("aria-label", `${pin.title} — ${label}`);

      const popup = new Popup({ offset: 16, closeButton: false }).setHTML(
        `<a href="${propertyUrl(pin)}" style="display:block;text-decoration:none;color:inherit;font-family:inherit;font-size:13px">
          <div style="font-weight:500;margin-bottom:2px">${escapeHtml(pin.title)}</div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#666">${escapeHtml(pin.reference)} · ${escapeHtml(label)}</div>
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
    // `prefs` is load-bearing: markers are imperative DOM, not React, so
    // nothing re-renders them on its own. Without it here the pins keep their
    // old currency until the pin set itself changes.
  }, [pins, ready, prefs]);

  // `bzmap` is what scopes the brand restyle of MapLibre's gesture overlay
  // (`globals.css`, `.bzmap .maplibregl-cooperative-gesture-screen`) — without
  // it the "use two fingers" scrim renders in the library's own 1.4em
  // black-40% default. The class contributes nothing else here: its
  // `position: relative` and `overflow: hidden` are what MapLibre's own
  // unlayered `.maplibregl-map` rule already sets, and its background sits
  // under the canvas.
  return (
    <div
      ref={containerRef}
      className={`bzmap ${CTRL_TOUCH_TARGET} ${className ?? ""}`.trim()}
      dir="ltr"
    />
  );
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
