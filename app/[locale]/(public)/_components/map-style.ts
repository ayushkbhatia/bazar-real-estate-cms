/**
 * Shared pastel basemap for every MapLibre surface — the home "Where to
 * live" map, the /…/search results map, and the property + development
 * location embeds. One look everywhere.
 *
 * CARTO Positron vector style, recoloured to Bazar's warm palette. Fetched
 * and transformed once, cached on a window global, then handed out as a
 * fresh clone per map so multiple maps on the same page (e.g. a
 * development's location embed *and* its "nearby developments" map) can't
 * mutate a shared style object out from under one another.
 *
 * On a fetch failure it degrades to a recoloured CARTO raster style, so a
 * map with no network still reads as pastel rather than falling back to
 * stock, colourful OSM tiles.
 *
 * Extracted from area-map.tsx (the original home-map implementation) so the
 * other surfaces match it byte-for-byte instead of drifting.
 */

const POSITRON_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Bazar warm palette — the ink the Positron layers get repainted with.
export const INK = {
  bg: "#f5f3ec",
  land: "#f0eee6",
  water: "#d3dad6",
  green: "#e5e8da",
  building: "#eae7dd",
  road: "#ffffff",
  roadCase: "#e6e3d8",
  boundary: "#d6d2c4",
  rail: "#e2dfd4",
  text: "#8b887c",
  textStrong: "#6d6a5f",
  halo: "rgba(245,243,236,0.92)",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function recolorStyle(style: any): any {
  const setPaint = (l: any, k: string, v: unknown) => {
    l.paint = Object.assign({}, l.paint, { [k]: v });
  };
  const hide = (l: any) => {
    l.layout = Object.assign({}, l.layout, { visibility: "none" });
  };
  (style.layers || []).forEach((l: any) => {
    const id = (l.id || "").toLowerCase();
    const sl = (l["source-layer"] || "").toLowerCase();
    if (/poi|airport|aeroway|transit|housenum|ferry/.test(id)) return hide(l);
    if (l.type === "background")
      return setPaint(l, "background-color", INK.bg);
    if (l.type === "fill") {
      if (/water/.test(id) || /water/.test(sl)) setPaint(l, "fill-color", INK.water);
      else if (/green|park|grass|wood|cemetery|pitch|garden/.test(id) || /park/.test(sl))
        setPaint(l, "fill-color", INK.green);
      else if (/building/.test(id) || /building/.test(sl)) {
        setPaint(l, "fill-color", INK.building);
        setPaint(l, "fill-opacity", 0.7);
      } else if (/sand|beach/.test(id)) setPaint(l, "fill-color", "#efe9d9");
      else setPaint(l, "fill-color", INK.land);
      return;
    }
    if (l.type === "line") {
      if (/boundary|admin/.test(id) || /boundary/.test(sl))
        setPaint(l, "line-color", INK.boundary);
      else if (/water|river|canal/.test(id) || /waterway/.test(sl))
        setPaint(l, "line-color", INK.water);
      else if (/rail|transit/.test(id)) setPaint(l, "line-color", INK.rail);
      else if (/case|casing/.test(id)) setPaint(l, "line-color", INK.roadCase);
      else setPaint(l, "line-color", INK.road);
      return;
    }
    if (l.type === "symbol") {
      // Minimal labels: keep place + water names, drop road shields etc.
      if (!/place|water|country|state/.test(id) && !/place|water_name/.test(sl))
        return hide(l);
      setPaint(l, "text-color", /city|town|country/.test(id) ? INK.textStrong : INK.text);
      setPaint(l, "text-halo-color", INK.halo);
      setPaint(l, "text-halo-width", 1.2);
    }
  });
  return style;
}

export function rasterFallbackStyle(): any {
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap · © CARTO",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": INK.bg } },
      {
        id: "tiles",
        type: "raster",
        source: "carto",
        paint: { "raster-saturation": -0.5, "raster-opacity": 0.88 },
      },
    ],
  };
}

/**
 * Resolve the pastel style — fetched, recoloured and cached once per page on
 * `window.__BZ_MAP_STYLE` — and return a fresh `structuredClone` each call.
 * MapLibre normalises (and mutates) the style object it's handed, so every
 * map instance must get its own copy or a second map on the page corrupts
 * the shared cache.
 */
export function pastelMapStyle(): Promise<any> {
  const w = window as any;
  if (!w.__BZ_MAP_STYLE) {
    w.__BZ_MAP_STYLE = fetch(POSITRON_STYLE_URL)
      .then((r) => r.json())
      .then(recolorStyle)
      .catch(rasterFallbackStyle);
  }
  return w.__BZ_MAP_STYLE.then((s: any) => structuredClone(s));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
