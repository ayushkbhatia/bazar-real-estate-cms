# ADR-0002: MapLibre GL for rendering; Mapbox APIs for geocoding and isochrones

Date: 2026-05-22 · Revised 2026-05-24
Status: Accepted
Deciders: Engineering

## Context

The original spec named Mapbox GL JS as the map renderer. Mapbox GL JS
v2+ is proprietary with API-call billing past a 50k loads/month free
tier — meaning preview deployments, e2e runs, and lhci runs are all
metered events. That pricing model doesn't suit a low-traffic boutique
marketplace where every preview deploy is a potential bill.

Separately, the spec wanted address typeahead on the valuation page and
isochrone polygons ("show me homes within 30 minutes by car") on the
search page. Both are Mapbox-API features with no obvious open-source
equivalent at the same quality.

## Decision

**Split the choice by surface:**

1. **Map rendering** uses **MapLibre GL JS** with OpenStreetMap raster
   tiles ([app/(public)/_components/map-view.tsx](../../app/(public)/_components/map-view.tsx)).
   No vendor account, no API key. Every map on the marketplace, the
   property detail page, the development detail page, and the
   draw-area-tool runs on this.

2. **Geocoding, reverse geocoding, and isochrones** use **Mapbox
   APIs** when `NEXT_PUBLIC_MAPBOX_TOKEN` is configured
   ([lib/mapbox.ts](../../lib/mapbox.ts)). Every Mapbox call resolves
   to `null` when the token is absent so the address typeahead
   degrades to a plain text field, the reverse-geocode falls back to
   the stored `address_line`, and the commute-time tool stays hidden.

## Consequences

- Zero map-load bill regardless of marketplace traffic. Preview
  deploys, e2e tests, and lhci runs cost nothing.
- Mapbox API costs are bounded by feature usage, not page load
  volume. Geocoding is $0.50/1k requests; isochrone $2/1k. At our
  expected interaction rates that's a few dollars a month, not a few
  hundred.
- We own the rendering bugs (MapLibre has no vendor). So far parity
  with the last open-source Mapbox release has been good; MapLibre 5
  resolved our two known issues without workarounds.
- OSM raster tiles are visually adequate but lack the polish of
  Mapbox Studio styles. If we want a luxury map design pass, we
  subscribe to **MapTiler** ($25/mo at our scale) and swap the tile
  source — the renderer doesn't change.
- The two-system split means contributors have to know which surface
  uses which library. The split is documented inline in `map-view.tsx`
  and `mapbox.ts`.

## When to revisit

- If the OSM courtesy-cap policy tightens and our load violates it.
- If Mapbox tile styling becomes load-bearing for brand (in which
  case: switch renderer too, or move to MapTiler with a custom style).
- If geocoding accuracy from a competitor (Google, MapTiler Geocoding)
  becomes materially better for the UAE.

## Alternatives considered

- **Mapbox GL JS for everything.** Rejected on pricing; metered map
  loads on every preview deploy.
- **Google Maps JS API.** Heavier bundle, separate UX style, similar
  metering trap.
- **Self-host MapTiler tiles + open-source geocoder (Nominatim).** Both
  exist; the open-source geocoders are noticeably weaker for UAE
  addresses (no postal codes here, dense Arabic transliteration), so
  the Mapbox geocoder pays for itself on UX alone.
