"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Crosshair, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { geocodeAddress, formatGeocodeFeatures } from "@/lib/mapbox";
import { setPropertyLocation } from "../_actions";

type Coords = { lat: number; lng: number };

// Abu Dhabi city centre — the empty-state map focus before a pin is dropped.
const DEFAULT_CENTER: [number, number] = [54.3773, 24.4539];
// Keyless OSM raster — same tiles the /buy search map uses. (MapTiler's free
// "?key=open" style now 403s, so we don't depend on it.) The client can swap
// to Mapbox/MapTiler-with-key at handover.
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
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

function coordsEqual(a: Coords | null, b: Coords | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
}

/**
 * Interactive map to set a property's pin, persisted independently of the
 * main edit form via `setPropertyLocation`. Click the map or drag the marker
 * to place it; type exact coordinates; or (when Mapbox is configured) search
 * an address. The saved pin drives the public property page's Location map.
 */
export function LocationPicker({
  propertyId,
  initialGeo,
  mapboxAvailable,
  onChange,
}: {
  propertyId: string;
  initialGeo: Coords | null;
  mapboxAvailable: boolean;
  /**
   * Controlled mode. When supplied the picker reports the pin upward and its
   * own Save button disappears — the parent form owns persistence. Used by the
   * development page editor, where the pin saves alongside the rest of the
   * project's content.
   */
  onChange?: (next: Coords | null) => void;
}) {
  const controlled = typeof onChange === "function";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [coords, setCoords] = useState<Coords | null>(initialGeo);
  const [savedCoords, setSavedCoords] = useState<Coords | null>(initialGeo);
  const [latInput, setLatInput] = useState(initialGeo ? String(initialGeo.lat) : "");
  const [lngInput, setLngInput] = useState(initialGeo ? String(initialGeo.lng) : "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; label: string; sub: string; center: [number, number] }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [saving, startSaving] = useTransition();

  const dirty = !coordsEqual(coords, savedCoords);

  // Mirror every pin move outward in controlled mode.
  useEffect(() => {
    if (controlled) onChange?.(coords);
    // `onChange` is a fresh closure each render in most parents; depending on
    // it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, controlled]);

  // On drag the marker has already moved — just mirror its position into
  // state (no need to reposition it). Stable, and self-reference-free so
  // `applyCoords` doesn't have to call itself.
  const syncMarkerToState = useCallback(() => {
    const p = markerRef.current?.getLngLat();
    if (!p) return;
    setCoords({ lat: p.lat, lng: p.lng });
    setLatInput(String(p.lat));
    setLngInput(String(p.lng));
  }, []);

  const applyCoords = useCallback(
    (next: Coords | null, recenter: boolean) => {
      setCoords(next);
      setLatInput(next ? String(next.lat) : "");
      setLngInput(next ? String(next.lng) : "");
      const map = mapRef.current;
      if (!map) return;
      if (next) {
        if (!markerRef.current) {
          markerRef.current = new maplibregl.Marker({
            color: "var(--bz-accent, #005777)",
            draggable: true,
          })
            .setLngLat([next.lng, next.lat])
            .addTo(map);
          markerRef.current.on("dragend", syncMarkerToState);
        } else {
          markerRef.current.setLngLat([next.lng, next.lat]);
        }
        if (recenter)
          map.easeTo({
            center: [next.lng, next.lat],
            zoom: Math.max(map.getZoom(), 14),
          });
      } else if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    },
    [syncMarkerToState],
  );

  // Init map once. Guard the WebGL init so an environment without it (jsdom
  // in tests, or a very old browser) degrades to the coordinate inputs +
  // search rather than throwing.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_STYLE,
        center: initialGeo ? [initialGeo.lng, initialGeo.lat] : DEFAULT_CENTER,
        zoom: initialGeo ? 14 : 10,
        attributionControl: { compact: true },
      });
    } catch {
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (e) => {
      applyCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng }, false);
    });
    if (initialGeo) {
      markerRef.current = new maplibregl.Marker({ color: "var(--bz-accent, #005777)", draggable: true })
        .setLngLat([initialGeo.lng, initialGeo.lat])
        .addTo(map);
      markerRef.current.on("dragend", syncMarkerToState);
    }
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [initialGeo, applyCoords, syncMarkerToState]);

  function commitInputs() {
    const lat = Number(latInput);
    const lng = Number(lngInput);
    if (
      latInput.trim() === "" ||
      lngInput.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      toast.error("Enter a valid latitude (−90…90) and longitude (−180…180).");
      return;
    }
    applyCoords({ lat, lng }, true);
  }

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const features = await geocodeAddress(query, {
        proximity: DEFAULT_CENTER,
        limit: 5,
      });
      setResults(formatGeocodeFeatures(features));
      if (features.length === 0) toast.message("No matches — try a broader search or drop the pin manually.");
    } finally {
      setSearching(false);
    }
  }

  function pickResult(center: [number, number]) {
    applyCoords({ lat: center[1], lng: center[0] }, true);
    setResults([]);
    setQuery("");
  }

  function onSave() {
    startSaving(async () => {
      const result = await setPropertyLocation(propertyId, coords);
      if (result.status === "ok") {
        setSavedCoords(coords);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-bz-accent" />
        <span className="text-[13.5px] font-medium">Map location</span>
        {coords ? (
          <span className="mono text-[11.5px] text-bz-muted">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </span>
        ) : (
          <span className="text-[11.5px] text-bz-muted">No pin set</span>
        )}
        {dirty ? (
          <span className="text-[11px] text-[oklch(0.55_0.12_60)]">· unsaved</span>
        ) : null}
      </div>

      {mapboxAvailable ? (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute start-2.5 top-1/2 -translate-y-1/2 text-bz-muted"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder="Search an address or place…"
                className="ps-8"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void runSearch()} disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
          {results.length > 0 ? (
            <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-bz-border bg-bz-surface shadow-lg">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pickResult(r.center)}
                    className="flex w-full flex-col items-start px-3 py-2 text-start hover:bg-bz-surface-2"
                  >
                    <span className="text-[13px] text-bz-ink">{r.label}</span>
                    <span className="text-[11.5px] text-bz-muted truncate">{r.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="w-full aspect-[16/10] rounded-lg overflow-hidden border border-bz-border bg-bz-surface-2"
      />
      <p className="text-[11.5px] text-bz-muted">
        Click the map or drag the pin to set the location.
        {mapboxAvailable ? "" : " Address search needs a Mapbox key (set at handover)."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="loc-lat">Latitude</Label>
          <Input
            id="loc-lat"
            inputMode="decimal"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={commitInputs}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitInputs();
              }
            }}
            placeholder="24.4539"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="loc-lng">Longitude</Label>
          <Input
            id="loc-lng"
            inputMode="decimal"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={commitInputs}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitInputs();
              }
            }}
            placeholder="54.3773"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {controlled ? null : (
          <Button type="button" onClick={onSave} disabled={saving || !dirty}>
            <Crosshair size={14} strokeWidth={1.8} />
            {saving ? "Saving…" : "Save location"}
          </Button>
        )}
        {coords ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => applyCoords(null, false)}
            disabled={saving}
          >
            <Trash2 size={14} strokeWidth={1.8} />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
