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
/**
 * Point every label layer at the Arabic name, falling back to whatever the
 * style already asked for.
 *
 * Three facts make this work, each verified against the live endpoints rather
 * than assumed — the first two are easy to get backwards:
 *
 *  1. The tileset carries `name:ar`. CARTO's `carto.streets` vector source
 *     exposes it on the `place` layer alongside ~70 other languages.
 *  2. Arabic glyphs are served, but NOT by the font the style names first.
 *     `Open Sans Regular` returns 52 BYTES for the Arabic range 1536-1791 —
 *     an empty response. `Noto Sans Regular` returns 52 KB, and it is the
 *     third member of every fontstack in this style. MapLibre falls back
 *     through a stack per glyph, so Arabic renders without touching
 *     `text-font`. (Anyone re-checking this: the two 52s are a coincidence of
 *     units, and mistaking one for the other is how you conclude the labels
 *     will work when they would render as tofu.)
 *  3. `setRTLTextPlugin` must be registered before the first map, or the
 *     glyphs arrive unjoined and left-to-right — worse than English.
 *
 * `coalesce` matters: an unlabelled feature would otherwise go blank rather
 * than keeping the Latin name it has today.
 */
export function localiseLabels(style: any, locale: string): any {
  if (locale !== "ar") return style;
  (style.layers || []).forEach((l: any) => {
    if (!l.layout?.["text-field"]) return;
    // A PURE expression, rather than wrapping whatever was there.
    //
    // The first attempt embedded the existing value as the coalesce fallback,
    // which looked conservative and was not: Positron's text-fields are
    // legacy token strings ("{name_en}") and legacy stop objects, and neither
    // is valid *inside* an expression. MapLibre rejected the style with
    // `layers[69].layout.text-field[2]: Bare objects invalid`, the source
    // never resolved, and the map requested zero tiles — a blank rectangle on
    // every Arabic page. It built and typechecked cleanly; only the browser
    // console said anything.
    //
    // name_en then name keeps the English behaviour intact when a feature has
    // no Arabic name, which is most of them outside the Gulf.
    l.layout = Object.assign({}, l.layout, {
      "text-field": [
        "coalesce",
        ["get", "name:ar"],
        ["get", "name_en"],
        ["get", "name"],
      ],
    });
  });
  return style;
}

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
export function pastelMapStyle(locale = "en"): Promise<any> {
  const w = window as any;
  // Keyed by locale. The cache used to be a single global, so on a page with
  // two maps the first one's language won for both — and after this change
  // that would have meant an English map and an Arabic map racing for one
  // slot.
  w.__BZ_MAP_STYLE = w.__BZ_MAP_STYLE || {};
  if (!w.__BZ_MAP_STYLE[locale]) {
    w.__BZ_MAP_STYLE[locale] = fetch(POSITRON_STYLE_URL)
      .then((r) => r.json())
      .then(recolorStyle)
      .then((s: any) => localiseLabels(s, locale))
      .catch(rasterFallbackStyle);
  }
  return w.__BZ_MAP_STYLE[locale].then((s: any) => structuredClone(s));
}

/**
 * Register the RTL text plugin, once per page, before any map is created.
 *
 * Self-hosted from /public/vendor rather than the unpkg URL MapLibre's own
 * docs suggest: this repo is handed to a client, and a runtime dependency on
 * a third-party CDN is one more thing that can break long after anyone is
 * looking at it.
 *
 * maplibre-gl 5.24 references `applyArabicShaping` and
 * `processBidirectionalText` but does not bundle them, so without this Arabic
 * labels render as isolated, unjoined, left-to-right letterforms.
 *
 * Lazy: the plugin only downloads when a map actually encounters RTL text.
 * Safe to call repeatedly — a second call while already set is a no-op that
 * would otherwise throw.
 */
export async function ensureRtlTextPlugin(
  maplibre: {
    setRTLTextPlugin: (url: string, lazy: boolean) => Promise<void>;
    getRTLTextPluginStatus?: () => string;
  },
): Promise<void> {
  const status = maplibre.getRTLTextPluginStatus?.();
  if (status && status !== "unavailable") return;
  try {
    await maplibre.setRTLTextPlugin("/vendor/mapbox-gl-rtl-text.js", true);
  } catch {
    // Already registered by another map on the page, or the file is missing.
    // Neither is worth taking a map down for: unshaped Arabic is ugly, a
    // thrown error is a blank rectangle.
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
