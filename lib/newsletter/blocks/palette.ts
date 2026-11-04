/**
 * Bazar's colours as literal hex — email has no CSS variables, so the brand
 * tokens in app/globals.css are restated here (the same values the recolour
 * set: navy, teal, taupe, and the cream the public site sits on).
 */
export const BAZAR = {
  navy: "#003452",
  teal: "#005777",
  taupe: "#99896E",
  taupeDeep: "#6E624D",
  cream: "#F4F0E8",
  sand: "#E9E2D4",
  page: "#ECE7DD",
  ink: "#1B1A17",
  muted: "#6B6355",
  white: "#FFFFFF",
} as const;

/** The swatches the colour fields offer first. */
export const BAZAR_SWATCHES: readonly { value: string; label: string }[] = [
  { value: BAZAR.navy, label: "Navy" },
  { value: BAZAR.teal, label: "Teal" },
  { value: BAZAR.taupe, label: "Taupe" },
  { value: BAZAR.taupeDeep, label: "Deep taupe" },
  { value: BAZAR.cream, label: "Cream" },
  { value: BAZAR.sand, label: "Sand" },
  { value: BAZAR.ink, label: "Ink" },
  { value: BAZAR.white, label: "White" },
];
