/**
 * Trimming the transparent margin off brand art.
 *
 * Design exports arrive on a square artboard with the mark floating in the
 * middle of it — the Bazar logo is 1484px of ink on a 5000px canvas, so 70% of
 * every box it is drawn in is empty. `object-contain` fits the *canvas*, not
 * the ink, so a 44px slot rendered a 13px glyph and the logo read as tiny no
 * matter how large the box got. The favicon was worse and could not be fixed
 * by sizing at all: the browser draws it at 16px and we do not control that
 * number, so the only lever is the file.
 *
 * So the padding comes off once, at upload, rather than being compensated for
 * at each of the places the art is drawn. `bboxOf` is the part worth testing —
 * the canvas plumbing around it is not.
 */

export type Bbox = { left: number; top: number; right: number; bottom: number };

/**
 * Tightest box containing every pixel at or above `threshold` alpha, or null
 * when the image is fully transparent.
 *
 * `right`/`bottom` are exclusive, matching canvas rect conventions.
 *
 * The threshold exists because antialiased edges and JPEG-ish artefacts leave
 * a halo of alpha 1–4 that is invisible but would defeat the trim: one stray
 * near-zero pixel in a corner and the bbox is the whole canvas again.
 */
export function bboxOf(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 8,
): Bbox | null {
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3]! < threshold) continue;
      found = true;
      if (x < left) left = x;
      if (x >= right) right = x + 1;
      if (y < top) top = y;
      if (y >= bottom) bottom = y + 1;
    }
  }

  return found ? { left, top, right, bottom } : null;
}

/**
 * How much of the canvas the ink actually covers, 0–1. Used to decide whether
 * a trim is worth offering and to phrase it for the operator.
 */
export function inkCoverage(bbox: Bbox, width: number, height: number): number {
  const area = width * height;
  if (area <= 0) return 0;
  return ((bbox.right - bbox.left) * (bbox.bottom - bbox.top)) / area;
}

/**
 * Below this, the file is mostly padding and trimming is a visible win. A
 * logo that already fills 95% of its canvas is left alone — re-encoding it
 * would cost quality for nothing.
 */
export const TRIM_COVERAGE_THRESHOLD = 0.92;
