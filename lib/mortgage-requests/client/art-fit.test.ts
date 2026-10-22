import { describe, expect, it } from "vitest";
import { ART_FILL, measureArt, UNMEASURED } from "./art-fit";

type RGBA = [number, number, number, number];
const WHITE: RGBA = [255, 255, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];
const INK: RGBA = [20, 40, 90, 255];
const BLUE: RGBA = [30, 90, 220, 255];

/** A `width` × `height` image of `ground` with `ink` filling [x0, x1) × [y0, y1). */
function image(width: number, height: number, ground: RGBA, ink?: { x0: number; y0: number; x1: number; y1: number; c: RGBA }) {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = ink && x >= ink.x0 && x < ink.x1 && y >= ink.y0 && y < ink.y1;
      px.set(inside ? ink.c : ground, (y * width + x) * 4);
    }
  }
  return px;
}

/** The drawn box's place in the tile, from a fit and the drawn box's place in the image. */
function placed(fit: ReturnType<typeof measureArt>, w: number, h: number, box: { x0: number; y0: number; x1: number; y1: number }) {
  if (fit.mode !== "contain") throw new Error("expected contain");
  return {
    left: fit.left + (box.x0 / w) * fit.width,
    top: fit.top + (box.y0 / h) * fit.height,
    right: fit.left + (box.x1 / w) * fit.width,
    bottom: fit.top + (box.y1 / h) * fit.height,
  };
}

describe("measureArt", () => {
  it("covers the tile with art that brings its own ground", () => {
    expect(measureArt(image(64, 64, BLUE), 64, 64)).toEqual({ mode: "cover" });
  });

  it("covers when the ground is only mostly coloured", () => {
    // A white card on a blue square: the ring is all blue.
    const px = image(64, 64, BLUE, { x0: 10, y0: 10, x1: 54, y1: 54, c: WHITE });
    expect(measureArt(px, 64, 64).mode).toBe("cover");
  });

  for (const [name, ground] of [["white", WHITE], ["transparent", CLEAR]] as const) {
    it(`trims a small drawing on ${name} and scales it to the art box, centred`, () => {
      const box = { x0: 8, y0: 20, x1: 24, y1: 28, c: INK };
      const fit = measureArt(image(64, 64, ground, box), 64, 64);
      const p = placed(fit, 64, 64, box);
      // The longer side (16 px wide) spans the art box; the drawing is centred.
      expect(p.right - p.left).toBeCloseTo(ART_FILL);
      expect((p.left + p.right) / 2).toBeCloseTo(0.5);
      expect((p.top + p.bottom) / 2).toBeCloseTo(0.5);
      expect(p.bottom - p.top).toBeCloseTo(ART_FILL / 2);
    });
  }

  it("keeps a wide image's aspect ratio", () => {
    const box = { x0: 4, y0: 4, x1: 60, y1: 28, c: INK };
    const fit = measureArt(image(64, 32, WHITE, box), 64, 32);
    if (fit.mode !== "contain") throw new Error("expected contain");
    expect(fit.width / fit.height).toBeCloseTo(2);
    const p = placed(fit, 64, 32, box);
    expect(p.right - p.left).toBeCloseTo(ART_FILL);
    expect((p.top + p.bottom) / 2).toBeCloseTo(0.5);
  });

  it("covers when the drawing runs off every edge", () => {
    expect(measureArt(image(64, 64, WHITE, { x0: 0, y0: 0, x1: 64, y1: 64, c: INK }), 64, 64)).toEqual({ mode: "cover" });
  });

  it("leaves a blank upload unmeasured", () => {
    expect(measureArt(image(16, 16, WHITE), 16, 16)).toEqual(UNMEASURED);
  });

  it("is unmeasured when the pixels don't match the size", () => {
    expect(measureArt(new Uint8ClampedArray(4), 4, 4)).toEqual(UNMEASURED);
  });
});
