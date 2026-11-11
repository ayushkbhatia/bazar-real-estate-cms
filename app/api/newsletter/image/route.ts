import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { mediaPublicUrl } from "@/lib/media";
import { parseEmailImageParams } from "@/lib/newsletter/email-image";

export const runtime = "nodejs";

/**
 * A newsletter image, fit for an inbox: resized, cropped to the design's
 * shape, tinted with the hero's overlay, re-encoded. See
 * lib/newsletter/email-image.ts for why.
 *
 * The answer for one query string never changes (a re-upload is a new key),
 * so it is cached for a year — at Vercel's edge and by Gmail's image proxy —
 * and this runs once per image, not once per open.
 *
 * Anything that goes wrong sends the reader to the original instead: a slow
 * image is better than a broken one in an email that has already gone out.
 */
const YEAR = 60 * 60 * 24 * 365;

export async function GET(req: NextRequest) {
  const p = parseEmailImageParams(req.nextUrl.searchParams);
  if (!p) return new NextResponse("Not an email image", { status: 400 });
  const original = mediaPublicUrl(p.key);
  if (!original) return new NextResponse("Media storage not configured", { status: 503 });

  try {
    const res = await fetch(original, { cache: "no-store" });
    if (!res.ok) throw new Error(`source ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());

    let img = sharp(input, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    const height = p.ratio ? Math.round(p.width / p.ratio) : undefined;
    img = img.resize({
      width: p.width,
      height,
      fit: height ? "cover" : "inside",
      position: "centre",
      withoutEnlargement: !height,
    });

    if (p.tint && p.opacity) {
      const box = await img.toBuffer({ resolveWithObject: true });
      const { width, height: h } = box.info;
      img = sharp(box.data).composite([
        {
          input: {
            create: {
              width,
              height: h,
              channels: 4,
              background: { r: parseInt(p.tint.slice(0, 2), 16), g: parseInt(p.tint.slice(2, 4), 16), b: parseInt(p.tint.slice(4, 6), 16), alpha: p.opacity / 100 },
            },
          },
        },
      ]);
    }

    // A logo keeps its transparency as PNG; everything else — a photo saved
    // as PNG with an alpha channel it never uses included — is a JPEG.
    const keepAlpha =
      !p.tint && !p.ratio && meta.hasAlpha === true && !(await sharp(input, { failOn: "none" }).stats()).isOpaque;
    const body = keepAlpha
      ? await img.png({ compressionLevel: 9 }).toBuffer()
      : await img.flatten({ background: "#ffffff" }).jpeg({ quality: 78, progressive: true, mozjpeg: true }).toBuffer();

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": keepAlpha ? "image/png" : "image/jpeg",
        "Cache-Control": `public, max-age=${YEAR}, immutable`,
        "CDN-Cache-Control": `public, max-age=${YEAR}, immutable`,
      },
    });
  } catch (error) {
    console.warn("[newsletter] email image fell back to the original:", error instanceof Error ? error.message : error);
    return NextResponse.redirect(original, { status: 302, headers: { "Cache-Control": "public, max-age=300" } });
  }
}
