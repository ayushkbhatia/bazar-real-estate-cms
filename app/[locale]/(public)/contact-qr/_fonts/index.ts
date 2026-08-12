import localFont from "next/font/local";

/**
 * 29LT Bukra — the Arabic face for the /contact-qr card.
 *
 * The brand's Latin stack (Geist / Instrument Serif) carries no Arabic, so the
 * Arabic side of the card was falling through to whatever the phone happened to
 * ship — Geeza Pro on iOS, Noto Naskh on Android — at a weight and colour that
 * never matched the English face. Bukra is a licensed self-hosted file so the
 * two faces are the same on every device.
 *
 * Loaded here rather than in the root layout because this is the only page with
 * an Arabic face: the two woff2 files (~75 KB) stay off every other route.
 */
export const bukra = localFont({
  src: [
    { path: "./bukra-regular.woff2", weight: "400", style: "normal" },
    { path: "./bukra-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-bukra",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
