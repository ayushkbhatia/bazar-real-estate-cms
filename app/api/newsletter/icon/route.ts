import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { amenityIcon, ICON_PX } from "@/lib/newsletter/blocks/amenity-icons";
import { AMENITY_GLYPHS } from "@/lib/newsletter/blocks/amenity-glyphs";

export const runtime = "nodejs";

/**
 * One amenity icon as a PNG, in one colour — for the newsletter's icon grid
 * (lib/newsletter/blocks/amenity-icons.ts says why it isn't SVG).
 *
 * `?n=<icon id>&c=<RRGGBB>`. Only icons in the catalogue and six-digit hex
 * colours are drawn; anything else is a 400, so the route can't be made to
 * render arbitrary markup. The answer for one query never changes, so it is
 * cached for a year at the edge and by Gmail's image proxy.
 */
const YEAR = 60 * 60 * 24 * 365;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const icon = amenityIcon(q.get("n"));
  const glyph = icon ? AMENITY_GLYPHS[icon.glyph] : undefined;
  const c = q.get("c") ?? "";
  if (!icon || !glyph || !/^[0-9A-Fa-f]{6}$/.test(c)) return new NextResponse("Not an icon", { status: 400 });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_PX}" height="${ICON_PX}" viewBox="0 0 24 24" fill="none" stroke="#${c}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
  try {
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${YEAR}, immutable`,
        "CDN-Cache-Control": `public, max-age=${YEAR}, immutable`,
      },
    });
  } catch (error) {
    console.warn("[newsletter] icon failed to draw:", error instanceof Error ? error.message : error);
    return new NextResponse("Icon unavailable", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
