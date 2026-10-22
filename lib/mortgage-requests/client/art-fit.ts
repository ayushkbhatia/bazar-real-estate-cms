/**
 * Fitting a document icon to its tile, whatever an editor uploaded in Pages &
 * blocks → Wizards → Document icons. Measured once from the image's own
 * pixels, so nobody has to crop or pad artwork before uploading it:
 *
 * - Art on a transparent or white ground is trimmed to what is drawn and
 *   scaled until that fills the tile's art box, centred. A logo with wide
 *   margins, or a wide one, reads at the same size as the shipped ones.
 * - Art that brings its own ground (a coloured square, a photograph) covers
 *   the tile edge to edge, clipped to its rounded corners, instead of
 *   floating as a hard-cornered square inside the white tile.
 */

/** Where the image goes, in fractions of the tile's side. */
export type ArtFit =
  | { mode: "cover" }
  | { mode: "contain"; left: number; top: number; width: number; height: number };

/** The share of the tile the drawn part of contained art spans, on its longer side. */
export const ART_FILL = 0.84;

/** The longer side of the copy the pixels are read from: enough to find edges, cheap to scan. */
export const SAMPLE_SIZE = 64;

/** Before (or without) a measurement: the whole image, contained in the art box. */
export const UNMEASURED: ArtFit = {
  mode: "contain",
  left: (1 - ART_FILL) / 2,
  top: (1 - ART_FILL) / 2,
  width: ART_FILL,
  height: ART_FILL,
};

/** A pixel that is ground, not drawing: (nearly) transparent, or (nearly) white. */
function isGround(px: ArrayLike<number>, i: number): boolean {
  return px[i + 3] < 24 || (px[i] >= 236 && px[i + 1] >= 236 && px[i + 2] >= 236);
}

/**
 * The fit for an image from its RGBA pixels (`width` × `height`, four bytes
 * each, as a canvas returns them). Art whose outer ring is mostly ground is
 * contained and trimmed; anything else covers.
 */
export function measureArt(px: ArrayLike<number>, width: number, height: number): ArtFit {
  if (width < 1 || height < 1 || px.length < width * height * 4) return UNMEASURED;

  let ring = 0;
  let ringGround = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ground = isGround(px, (y * width + x) * 4);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        ring++;
        if (ground) ringGround++;
      }
      if (!ground) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  if (ringGround / ring < 0.9) return { mode: "cover" };
  // Nothing drawn at all (a blank or all-white upload): leave it as it is.
  if (x1 < 0) return UNMEASURED;

  const drawnW = x1 - x0 + 1;
  const drawnH = y1 - y0 + 1;
  const scale = ART_FILL / Math.max(drawnW, drawnH);
  return {
    mode: "contain",
    left: 0.5 - (x0 + drawnW / 2) * scale,
    top: 0.5 - (y0 + drawnH / 2) * scale,
    width: width * scale,
    height: height * scale,
  };
}

/**
 * Reads a loaded image's pixels and measures it. Unmeasured when the browser
 * won't hand them over (an image from a host that sends no CORS header).
 */
export function measureImage(img: HTMLImageElement): ArtFit {
  // An SVG without width and height has no natural size; treat it as square.
  const naturalW = img.naturalWidth || SAMPLE_SIZE;
  const naturalH = img.naturalHeight || SAMPLE_SIZE;
  const k = SAMPLE_SIZE / Math.max(naturalW, naturalH);
  const width = Math.max(1, Math.round(naturalW * k));
  const height = Math.max(1, Math.round(naturalH * k));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return UNMEASURED;
    ctx.drawImage(img, 0, 0, width, height);
    return measureArt(ctx.getImageData(0, 0, width, height).data, width, height);
  } catch {
    return UNMEASURED;
  }
}
