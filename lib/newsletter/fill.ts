/**
 * A band that fades from one colour to another, top to bottom.
 *
 * Gmail drops a CSS `linear-gradient` and Outlook for Windows draws no CSS
 * background at all, so a gradient written in CSS reaches almost no inbox
 * (the same lesson as the hero's overlay, Nov 2026). Instead the fade is a
 * tiny PNG made by `/api/newsletter/fill` — four pixels wide, a column of
 * colour — set as the cell's background and stretched to fill it
 * (`background-size:100% 102%` — a hair past each edge, so a seam that
 * falls on a fraction of a pixel doesn't show). Every client that shows
 * background images shows the fade; Outlook for Windows shows the cell's
 * `bgcolor`, the colour halfway between, which still reads as the band.
 *
 * Bands chain: one block fading A → B over another fading B → C reads as
 * one band from A to C, which is how the showcase template paints a section
 * several blocks tall.
 *
 * Pure: the renderer and the route share it.
 */

export const FILL_PATH = "/api/newsletter/fill";
export const FILL_HEIGHT = 512;
export const FILL_WIDTH = 4;

const HEX = /^#?([0-9a-f]{6})$/i;

function clean(hex: string): string | null {
  const m = HEX.exec(hex.trim());
  return m ? m[1]!.toUpperCase() : null;
}

/** The fade's address, or null when either colour isn't a hex colour or both are the same. */
export function fillUrl(siteUrl: string, from: string, to: string): string | null {
  const f = clean(from);
  const t = clean(to);
  if (!f || !t || f === t) return null;
  return `${siteUrl}${FILL_PATH}?f=${f}&t=${t}`;
}

export function parseFill(q: URLSearchParams): { from: string; to: string } | null {
  const f = clean(q.get("f") ?? "");
  const t = clean(q.get("t") ?? "");
  return f && t ? { from: f, to: t } : null;
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The colour `at` of the way from one hex colour to another (0–1), as `#RRGGBB`. */
export function mixHex(from: string, to: string, at: number): string {
  const a = channels(from);
  const b = channels(to);
  const k = Math.max(0, Math.min(1, at));
  return `#${a
    .map((v, i) => Math.round(v + (b[i]! - v) * k).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/**
 * `n` bands that together fade `from` → `to`: band i runs from stop i to
 * stop i + 1, so each starts where the last ended.
 */
export function chainStops(from: string, to: string, n: number): [string, string][] {
  return Array.from({ length: n }, (_, i) => [mixHex(from, to, i / n), mixHex(from, to, (i + 1) / n)]);
}
