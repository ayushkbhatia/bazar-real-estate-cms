/**
 * Fluid type helper for the marketing master pages.
 *
 * The design handoff is a 1440px desktop reference with fixed serif sizes
 * (40 … 88px). Tailwind's JIT can't pick up dynamic `text-[${n}px]` classes,
 * so numeric sizes are applied via inline `font-size` using a `clamp()` that
 * scales fluidly from a mobile floor up to the desktop size (hit at ~1440px).
 *
 * `--bz-ar-heading-trim` is declared only on an Arabic h1/h2 (globals.css), so
 * everywhere else it falls back to 0px and the size is the clamp alone. An
 * inline style can't be overridden by that stylesheet's size rules, so the
 * trim has to ride along inside the value.
 */
export function fluid(size: number, floorRatio = 0.5): string {
  const floor = Math.round(size * floorRatio);
  // vw factor so the preferred value equals `size` at a 1440px viewport.
  const vw = (size / 14.4).toFixed(2);
  return `calc(clamp(${floor}px, ${vw}vw, ${size}px) - var(--bz-ar-heading-trim, 0px))`;
}
