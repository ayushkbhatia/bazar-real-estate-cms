/**
 * The one place Bazar's HQ coordinate is written down.
 *
 * Two public surfaces render this office — the `/contact` HQ map band and the
 * `/about` location section — and until now each held its own hand-typed pair.
 * They disagreed by ~1.1km: `/contact` carried the verified rooftop coordinate,
 * `/about` a stale 24.4619, 54.3487 that dropped the pin in the water off Al
 * Bateen, under a comment claiming the two surfaces stayed 1:1. Importing the
 * pair is what makes that comment true.
 */

// Verified office location — Bazar Real Estate, Sheikha Salama Building,
// Zayed The First Street, Al Bateen, Abu Dhabi.
export const HQ_LAT = 24.468113844266917;
export const HQ_LNG = 54.339882834551275;

// "Get directions" → the office's own Google Maps listing, the link the
// client shares (it resolves to the "Bazar Real Estate" place, ~10m from the
// pin above). A place link rather than a bare coordinate, so the visitor lands
// on the business — its name, hours and reviews — with directions one tap
// away, and the native Maps app opens it on a phone.
export const HQ_DIRECTIONS_URL = "https://maps.app.goo.gl/seUTWRQP63H69fEd6";
