/**
 * A photo for a share card, shrunk to the slot it fills.
 *
 * `next/og` inlines every `<img>` into the SVG it rasterises, as base64 of the
 * ORIGINAL file. The rasteriser refuses an SVG over 10 MB, so one large upload
 * fails the route — and because these routes prerender, it fails the whole
 * production build. That happened on 26 Nov 2026: an article went live with a
 * 10.4 MB upscaled PNG as its hero, and every build after it died on
 * "Buffer size limit exceeded" while drawing that article's card.
 *
 * So the photo is fetched here, cropped and scaled to the card's slot with
 * sharp (installed with Next for its image optimiser), and handed to the card
 * as a small JPEG data URI. A card is 1200×630; nothing it shows needs more.
 *
 * Returns null when there is nothing usable — no URL, a failed fetch, or bytes
 * sharp can't read — and every caller already draws its no-photo variant for
 * null. A share card without its photo beats a failed build.
 */
import sharp from "sharp";

export async function ogPhoto(
  url: string | null | undefined,
  size: { width: number; height: number },
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const jpeg = await sharp(input, { limitInputPixels: false })
      .rotate()
      .resize(size.width, size.height, { fit: "cover" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    console.error("[og] photo could not be prepared", url, err);
    return null;
  }
}
