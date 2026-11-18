import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { FILL_HEIGHT, FILL_WIDTH, mixHex, parseFill } from "@/lib/newsletter/fill";

export const runtime = "nodejs";

/**
 * A newsletter band's colour fade as a PNG: a column of colour from `f` at
 * the top to `t` at the bottom, stretched to the band by the email's CSS
 * (lib/newsletter/fill.ts says why it isn't a CSS gradient). Only two hex
 * colours are read, the answer never changes, and it is cached for a year.
 */
const YEAR = 60 * 60 * 24 * 365;

export async function GET(req: NextRequest) {
  const fill = parseFill(req.nextUrl.searchParams);
  if (!fill) return new NextResponse("Not a fill", { status: 400 });
  const px = Buffer.alloc(FILL_WIDTH * FILL_HEIGHT * 3);
  for (let y = 0; y < FILL_HEIGHT; y++) {
    const hex = mixHex(fill.from, fill.to, y / (FILL_HEIGHT - 1));
    const n = Number.parseInt(hex.slice(1), 16);
    for (let x = 0; x < FILL_WIDTH; x++) {
      const i = (y * FILL_WIDTH + x) * 3;
      px[i] = (n >> 16) & 255;
      px[i + 1] = (n >> 8) & 255;
      px[i + 2] = n & 255;
    }
  }
  const png = await sharp(px, { raw: { width: FILL_WIDTH, height: FILL_HEIGHT, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${YEAR}, immutable`,
      "CDN-Cache-Control": `public, max-age=${YEAR}, immutable`,
    },
  });
}
