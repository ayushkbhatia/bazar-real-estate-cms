/**
 * Fluid type helper for the marketing master pages.
 *
 * The design handoff is a 1440px desktop reference with fixed serif sizes
 * (40 … 88px). Tailwind's JIT can't pick up dynamic `text-[${n}px]` classes,
 * so numeric sizes are applied via inline `font-size` using a `clamp()` that
 * scales fluidly from a mobile floor up to the desktop size (hit at ~1440px).
 */
export function fluid(size: number, floorRatio = 0.5): string {
  const floor = Math.round(size * floorRatio);
  // vw factor so the preferred value equals `size` at a 1440px viewport.
  const vw = (size / 14.4).toFixed(2);
  return `clamp(${floor}px, ${vw}vw, ${size}px)`;
}
