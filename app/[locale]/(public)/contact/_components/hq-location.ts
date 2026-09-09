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

// "Get directions" → Google Maps directions to the office. The api=1 URL
// scheme opens the native Maps app on mobile (in directions mode) and the web
// app on desktop, so it works wherever it's opened or shared.
export const HQ_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${HQ_LAT},${HQ_LNG}`;
