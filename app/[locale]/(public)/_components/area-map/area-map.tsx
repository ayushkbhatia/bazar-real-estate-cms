"use client";

/**
 * Interactive area map (MapLibre GL) — the shared engine behind the home
 * "Where to live" section and the map band on /areas/[slug].
 *
 * Ported from the design handoff (area-map.jsx) but rebuilt as a typed,
 * *controlled* client component: the parent owns `emirate` + `focusSlug`
 * and gets notified through `onSelectArea`, so a Server Component can feed
 * it serialisable props with zero per-request work.
 *
 * Behaviour: zoomed out → area pins with listing counts; click a pin →
 * flyout (count · median AED/ft² · YoY) with "View community guide" +
 * "Zoom to N listings"; past z≈12.5 pins go quiet and individual listing
 * dots appear; click a dot → mini popup → property page.
 *
 * Dots render as a single circle layer (handoff-faithful). Native
 * `cluster:true` is the documented scale path once any area exceeds ~100
 * live listings; today the densest area has 26, so a plain layer is both
 * lighter and free of the glyphs dependency clustering's count labels need.
 */

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowRight,
  Locate,
  MapPin,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import { dotMeta, type AreaPin, type AreaDot } from "@/lib/queries/area-map";
import { pastelMapStyle } from "../map-style";
import {
  areaUnitLabel,
  formatPrice,
  formatPricePerArea,
  usePreferences,
} from "@/lib/preferences";

// City overviews — where the camera sits per emirate (matches the handoff).
const CITIES: Record<
  string,
  { label: string; center: [number, number]; zoom: number }
> = {
  "abu-dhabi": { label: "Abu Dhabi", center: [54.46, 24.48], zoom: 10.6 },
  dubai: { label: "Dubai", center: [55.22, 25.14], zoom: 10.4 },
};

const DOT_REVEAL_ZOOM = 12.5;
const PIN_QUIET_ZOOM = 12.4;
const AREA_ZOOM = 12.9;
const AREA_DEEP_ZOOM = 13.8;
const DETAIL_ZOOM = 13.5;

// WebGL paint can't parse oklch() tokens — resolve the teal accent to hex.
const ACCENT_HEX = "#005777";

type Props = {
  areas: AreaPin[];
  dots: AreaDot[];
  emirate: string;
  focusSlug?: string | null;
  onSelectArea?: (slug: string | null) => void;
  mode?: "explore" | "detail";
  /**
   * Camera-only initial framing: centre on this area's centroid at
   * detail zoom on mount, without opening its flyout. Used by the area
   * detail page (the flyout for the page's own area would be redundant).
   */
  centerSlug?: string;
  /**
   * Where a dot popup's CTA links. Defaults to the public property page
   * (`/p/<slug>-<ref>`); the New Projects map overrides it to point each
   * project dot at its off-plan detail page.
   */
  dotHref?: (dot: AreaDot) => string;
  /** Dot popup CTA label. Defaults to "View property". */
  dotCtaLabel?: string;
  /**
   * Noun for a pin's count in the flyout ("6 Listings" / "Zoom to 6
   * listings"). Defaults to listings; the off-plan map passes projects.
   */
  countNoun?: { singular: string; plural: string };
  className?: string;
};

const DEFAULT_COUNT_NOUN = { singular: "listing", plural: "listings" };
const DEFAULT_DOT_HREF = (d: AreaDot) =>
  `/p/${d.slug}-${d.reference.toLowerCase()}`;

// Basemap (CARTO Positron recoloured to Bazar's warm palette) now lives in
// the shared ../map-style module so every map surface matches this one.

function dotsToFeatureCollection(dots: AreaDot[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: dots.map((d) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [d.lng, d.lat] },
      properties: {
        slug: d.slug,
        reference: d.reference,
        priceAed: d.priceAed,
        title: d.title,
        beds: d.beds,
        builtUpFt2: d.builtUpFt2,
        metaText: d.metaText,
      },
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Small hooks
// ─────────────────────────────────────────────────────────────────────
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Force a re-render on every map `move`, coalesced to one per frame so
 *  projected pins/popups track the camera without thrashing React. */
function useRafRerenderOnMove(map: MapLibreMap | null) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!map) return;
    let raf = 0;
    const onMove = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        force();
      });
    };
    map.on("move", onMove);
    return () => {
      map.off("move", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [map]);
}

// ─────────────────────────────────────────────────────────────────────
// AreaMap
// ─────────────────────────────────────────────────────────────────────
export function AreaMap({
  areas,
  dots,
  emirate,
  focusSlug,
  onSelectArea,
  mode = "explore",
  centerSlug,
  dotHref = DEFAULT_DOT_HREF,
  dotCtaLabel = "View property",
  countNoun = DEFAULT_COUNT_NOUN,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [dot, setDot] = useState<AreaDot | null>(null);
  const reduced = usePrefersReducedMotion();
  // Skip the emirate/focus fly effects on first mount — the constructor
  // already framed the initial camera.
  const mounted = useRef(false);
  // Tracks the last emirate we flew to, so the emirate effect fires only
  // on an actual change — not when it re-runs as the map finishes loading
  // (which would clobber a detail page's initial centerSlug framing).
  const prevEmirate = useRef(emirate);

  const select = useCallback(
    (slug: string | null) => onSelectArea?.(slug),
    [onSelectArea],
  );

  const flyToArea = useCallback(
    (a: AreaPin, deep = false) => {
      const m = mapRef.current;
      if (!m) return;
      const zoom = deep ? AREA_DEEP_ZOOM : AREA_ZOOM;
      if (reduced) m.jumpTo({ center: [a.lng, a.lat], zoom });
      else
        m.flyTo({ center: [a.lng, a.lat], zoom, duration: 1600, essential: true });
    },
    [reduced],
  );

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let dead = false;
    let m: MapLibreMap | null = null;

    // Frame on the deep-linked area (detail page) or the current
    // selection; fall back to the emirate overview.
    const framingSlug = centerSlug ?? focusSlug;
    const focus = framingSlug
      ? areas.find((a) => a.slug === framingSlug)
      : null;
    const city = CITIES[emirate] ?? CITIES["abu-dhabi"];
    const center: [number, number] = focus ? [focus.lng, focus.lat] : city.center;
    const zoom = focus ? DETAIL_ZOOM : city.zoom;

    pastelMapStyle().then((style) => {
      if (dead || !containerRef.current) return;
      m = new maplibregl.Map({
        container: containerRef.current,
        style,
        center,
        zoom,
        minZoom: 8.5,
        maxZoom: 16.5,
        attributionControl: false,
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 120,
      });
      m.touchZoomRotate?.disableRotation();

      m.on("load", () => {
        if (dead || !m) return;
        m.addSource("bz-listings", {
          type: "geojson",
          data: dotsToFeatureCollection(dots),
        });
        m.addLayer({
          id: "bz-dots",
          type: "circle",
          source: "bz-listings",
          minzoom: 11.9,
          paint: {
            "circle-color": ACCENT_HEX,
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              2.5,
              13.5,
              5.5,
              16,
              8,
            ],
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              0,
              DOT_REVEAL_ZOOM,
              0.95,
            ],
            "circle-stroke-color": "#FAFAF6",
            "circle-stroke-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              0.4,
              14,
              1.6,
            ],
            "circle-stroke-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              0,
              DOT_REVEAL_ZOOM,
              1,
            ],
          },
        });

        m.on("mouseenter", "bz-dots", () => {
          m!.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", "bz-dots", () => {
          m!.getCanvas().style.cursor = "";
        });
        m.on("click", "bz-dots", (e) => {
          const f = e.features?.[0];
          if (!f || f.geometry.type !== "Point") return;
          const [lng, lat] = f.geometry.coordinates as [number, number];
          const p = f.properties as Record<string, unknown>;
          // MapLibre round-trips feature properties through its tile encoder,
          // which does not reliably preserve `null` — hence the explicit
          // nullish checks rather than trusting the value back out.
          setDot({
            lng,
            lat,
            slug: String(p.slug),
            reference: String(p.reference),
            priceAed: Number(p.priceAed) || 0,
            title: String(p.title),
            beds: p.beds == null ? null : Number(p.beds),
            builtUpFt2: p.builtUpFt2 == null ? null : Number(p.builtUpFt2),
            metaText: p.metaText ? String(p.metaText) : null,
          });
        });
        // Click on empty map closes any open dot popup.
        m.on("click", (e) => {
          const hits = m!.getLayer("bz-dots")
            ? m!.queryRenderedFeatures(e.point, { layers: ["bz-dots"] })
            : [];
          if (!hits.length) setDot(null);
        });
        // Programmatic camera moves (emirate toggle, area fly, zoom-to-
        // listings) close any open popup; user pans/zooms carry an
        // originalEvent and are left alone.
        m.on("movestart", (ev) => {
          if (!(ev as { originalEvent?: unknown }).originalEvent) setDot(null);
        });

        setMap(m);
        mounted.current = true;
      });

      mapRef.current = m;
    });

    return () => {
      dead = true;
      if (m) m.remove();
      mapRef.current = null;
    };
    // Camera framing + layers are set once on mount; later changes are
    // handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the dots source in sync if the `dots` prop changes.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !map) return;
    const src = m.getSource("bz-listings") as maplibregl.GeoJSONSource | undefined;
    src?.setData(dotsToFeatureCollection(dots));
  }, [dots, map]);

  // Emirate toggle → fly the camera between cities. Guarded on an actual
  // emirate change so the mount-time re-run (when `map` first sets) can't
  // override the initial framing — critical for the detail page, which
  // frames on its own area via centerSlug.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !map) return;
    if (prevEmirate.current === emirate) return;
    prevEmirate.current = emirate;
    const city = CITIES[emirate];
    if (!city) return;
    if (reduced) m.jumpTo({ center: city.center, zoom: city.zoom });
    else
      m.flyTo({
        center: city.center,
        zoom: city.zoom,
        duration: 2400,
        essential: true,
      });
    // reduced is read as a live value; don't refly when it flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emirate, map]);

  // External selection (chip click / deep link) → fly to the area.
  useEffect(() => {
    if (!map || !mounted.current || !focusSlug) return;
    const a = areas.find((x) => x.slug === focusSlug);
    if (a) flyToArea(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSlug, map]);

  const visibleAreas = areas.filter((a) => a.emirate === emirate);
  const city = CITIES[emirate] ?? CITIES["abu-dhabi"];
  const emirateEmpty = visibleAreas.length === 0;

  return (
    <div className={`bzmap ${className ?? ""}`.trim()}>
      <div ref={containerRef} className="bzmap__gl" dir="ltr" />
      <div className="bzmap__credit">© OpenStreetMap · © CARTO</div>

      {map && (
        <Overlay
          map={map}
          areas={visibleAreas}
          focusSlug={focusSlug ?? null}
          onSelectArea={select}
          onZoomToListings={(a) => flyToArea(a, true)}
          dot={dot}
          onCloseDot={() => setDot(null)}
          dotHref={dotHref}
          dotCtaLabel={dotCtaLabel}
          countNoun={countNoun}
        />
      )}

      {map && (
        <ZoomControls
          map={map}
          reduced={reduced}
          reset={{ center: city.center, zoom: city.zoom }}
          showReset={mode === "detail"}
        />
      )}

      {map && emirateEmpty && (
        <div className="bzmap-empty">
          <div className="serif" style={{ fontSize: 22, color: "var(--bz-ink)" }}>
            {city.label} is coming soon
          </div>
          <div style={{ fontSize: 13, color: "var(--bz-ink-2)" }}>
            We&rsquo;re curating listings here now.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Overlay — projected pins + flyout + dot popup (re-projects on move)
// ─────────────────────────────────────────────────────────────────────
function Overlay({
  map,
  areas,
  focusSlug,
  onSelectArea,
  onZoomToListings,
  dot,
  onCloseDot,
  dotHref,
  dotCtaLabel,
  countNoun,
}: {
  map: MapLibreMap;
  areas: AreaPin[];
  focusSlug: string | null;
  onSelectArea: (slug: string | null) => void;
  onZoomToListings: (a: AreaPin) => void;
  dot: AreaDot | null;
  onCloseDot: () => void;
  dotHref: (dot: AreaDot) => string;
  dotCtaLabel: string;
  countNoun: { singular: string; plural: string };
}) {
  useRafRerenderOnMove(map);
  const z = map.getZoom();
  const el = map.getContainer();
  const w = el.clientWidth;
  const h = el.clientHeight;
  const selected = focusSlug ? areas.find((a) => a.slug === focusSlug) ?? null : null;

  return (
    <>
      {areas.map((a) => {
        const p = map.project([a.lng, a.lat]);
        if (p.x < -180 || p.x > w + 180 || p.y < -80 || p.y > h + 120) return null;
        const cls = [
          "bzmap-pin",
          focusSlug === a.slug ? "is-active" : "",
          z > PIN_QUIET_ZOOM && focusSlug !== a.slug ? "is-quiet" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={a.id}
            type="button"
            className={cls}
            style={{ left: p.x, top: p.y - 6 }}
            onClick={() => onSelectArea(a.slug)}
          >
            <span className="bzmap-pin__name">{a.name}</span>
            <span className="bzmap-pin__count">{a.count}</span>
          </button>
        );
      })}

      {selected && (
        <Flyout
          area={selected}
          countNoun={countNoun}
          onClose={() => onSelectArea(null)}
          onZoomToListings={() => onZoomToListings(selected)}
        />
      )}

      {dot && (
        <DotPopupCard
          map={map}
          dot={dot}
          href={dotHref(dot)}
          ctaLabel={dotCtaLabel}
          onClose={onCloseDot}
        />
      )}

      {!dot && z < DOT_REVEAL_ZOOM && (
        <div className="bzmap-hint">
          <MapPin size={13} strokeWidth={2} /> Click an area pin — zoom in to see
          individual {countNoun.plural}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Flyout — area summary card
// ─────────────────────────────────────────────────────────────────────
function Flyout({
  area,
  countNoun,
  onClose,
  onZoomToListings,
}: {
  area: AreaPin;
  countNoun: { singular: string; plural: string };
  onClose: () => void;
  onZoomToListings: () => void;
}) {
  const { prefs } = usePreferences();
  const emirateLabel = CITIES[area.emirate]?.label ?? "Abu Dhabi";
  // Stored AED/ft²; shown in the visitor's currency per their area unit.
  const median =
    area.medianPerFt2 != null
      ? formatPricePerArea(area.medianPerFt2, prefs).replace(/\/(ft²|m²)$/, "")
      : "—";
  const yoy =
    area.yoyChange != null
      ? `${area.yoyChange > 0 ? "+" : ""}${area.yoyChange}%`
      : "—";
  const countLabel =
    countNoun.plural.charAt(0).toUpperCase() + countNoun.plural.slice(1);
  const stats: [string, string][] = [
    [String(area.count), countLabel],
    [median, `Median /${areaUnitLabel(prefs.area_unit)}`],
    [yoy, "YoY"],
  ];

  return (
    <div className="bzmap-flyout">
      <div className="bzmap-flyout__head">
        <button
          type="button"
          className="bzmap-flyout__close"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={16} />
        </button>
        <div>
          <div className="eyebrow" style={{ color: "rgba(255,255,255,0.8)" }}>
            {emirateLabel}
          </div>
          <div
            className="serif"
            style={{ fontSize: 24, letterSpacing: "-0.02em", marginTop: 2 }}
          >
            {area.name}
          </div>
        </div>
      </div>

      {area.tag && (
        <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--bz-muted)" }}>
          {area.tag}
        </div>
      )}

      <div className="bzmap-flyout__stats">
        {stats.map(([v, l]) => (
          <div key={l}>
            <div className="serif" style={{ fontSize: 17, letterSpacing: "-0.01em" }}>
              {v}
            </div>
            <div style={{ fontSize: 10, color: "var(--bz-muted)", marginTop: 2 }}>
              {l}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <Link
          href={`/areas/${area.slug}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-bz-ink px-4 text-sm font-medium text-bz-bg transition-colors hover:bg-bz-ink/90"
        >
          View community guide <ArrowRight size={15} />
        </Link>
        <button
          type="button"
          onClick={onZoomToListings}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-bz-border px-4 text-sm text-bz-ink-2 transition-colors hover:bg-bz-surface-2"
        >
          <Search size={14} /> Zoom to {area.count}{" "}
          {area.count === 1 ? countNoun.singular : countNoun.plural}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Dot popup — mini listing card, projected at the dot
// ─────────────────────────────────────────────────────────────────────
function DotPopupCard({
  map,
  dot,
  href,
  ctaLabel,
  onClose,
}: {
  map: MapLibreMap;
  dot: AreaDot;
  href: string;
  ctaLabel: string;
  onClose: () => void;
}) {
  const { prefs } = usePreferences();
  const p = map.project([dot.lng, dot.lat]);
  return (
    <div className="bzmap-popup" style={{ left: p.x, top: p.y }}>
      <div style={{ padding: "12px 14px 14px" }}>
        <button
          type="button"
          className="bzmap-flyout__close"
          aria-label="Close"
          style={{ width: 26, height: 26 }}
          onClick={onClose}
        >
          <X size={14} />
        </button>
        <div className="serif" style={{ fontSize: 19, letterSpacing: "-0.015em" }}>
          {dot.priceAed > 0
            ? formatPrice(dot.priceAed, prefs)
            : "Price on request"}
        </div>
        <div style={{ fontSize: 12, color: "var(--bz-ink-2)", marginTop: 3 }}>
          {dot.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--bz-muted)", marginTop: 2 }}>
          {dot.metaText ?? dotMeta(dot.beds, dot.builtUpFt2, prefs.area_unit)}
        </div>
        <Link
          href={href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
            color: "var(--bz-accent)",
            marginTop: 10,
          }}
        >
          {ctaLabel} <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Zoom controls
// ─────────────────────────────────────────────────────────────────────
function ZoomControls({
  map,
  reduced,
  reset,
  showReset,
}: {
  map: MapLibreMap;
  reduced: boolean;
  reset: { center: [number, number]; zoom: number };
  showReset: boolean;
}) {
  return (
    <div className="bzmap__ctrls">
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <Plus size={16} />
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()}>
        <Minus size={16} />
      </button>
      {showReset && <hr />}
      {showReset && (
        <button
          type="button"
          aria-label="Back to city view"
          onClick={() =>
            reduced
              ? map.jumpTo({ center: reset.center, zoom: reset.zoom })
              : map.flyTo({ ...reset, essential: true })
          }
        >
          <Locate size={15} />
        </button>
      )}
    </div>
  );
}
