import { IBM_Plex_Sans_Arabic } from "next/font/google";

/**
 * The Arabic face, in its own module so the root layout can `await import()`
 * it only when the locale needs it.
 *
 * That dynamic import is the point. `next/font` emits a `<link rel="preload">`
 * for every face declared in a module the layout imports statically, so
 * declaring this alongside Geist would push ~50 KB of Arabic woff2 onto every
 * English page for nothing — and the preload tag is a measurable LCP cost, not
 * just wasted bytes. lighthouserc audits `/ar/` for exactly this reason.
 *
 * IBM Plex Sans Arabic over the alternatives because it is a dual-script
 * superfamily: its Latin is drawn to sit beside its Arabic at the same optical
 * weight, and Arabic pages here are full of Latin runs — AED, ft², BR-1042,
 * developer names. A pairing of two unrelated families shows the seam on every
 * price.
 *
 * The 29LT Bukra faces already vendored under `contact-qr/_fonts` are the
 * designer's choice and look better, but they were licensed for one page.
 * Swapping is a one-file change once procurement confirms coverage — see the
 * open questions in ADR-0007.
 */
export const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  // 400/500/600 only. Arabic letterforms are connected, and at 700+ the
  // counters on ب ت ث and the loops on ه ة close up at body sizes.
  weight: ["400", "500", "600"],
  display: "swap",
});
