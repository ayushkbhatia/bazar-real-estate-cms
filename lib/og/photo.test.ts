// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { ogPhoto } from "./photo";

afterEach(() => {
  vi.unstubAllGlobals();
});

function serve(body: Buffer | null, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ok && body
        ? new Response(new Uint8Array(body), { status: 200 })
        : new Response("nope", { status: 404 }),
    ),
  );
}

describe("ogPhoto", () => {
  it("shrinks a large photo to a small JPEG of the slot's size", async () => {
    // Noise does not compress: ~12 MB as PNG, the shape of the upload that
    // broke the build on 26 Nov 2026.
    const w = 2000;
    const h = 2000;
    const raw = Buffer.alloc(w * h * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
    const png = await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(png.length).toBeGreaterThan(10_000_000);
    serve(png);

    const uri = await ogPhoto("https://x/photo.png", { width: 420, height: 630 });
    expect(uri).toMatch(/^data:image\/jpeg;base64,/);
    const out = Buffer.from(uri!.split(",")[1]!, "base64");
    expect(out.length).toBeLessThan(1_000_000);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([420, 630]);
  }, 30_000);

  it("answers null, not a throw, for no URL, a failed fetch or unreadable bytes", async () => {
    expect(await ogPhoto(null, { width: 10, height: 10 })).toBeNull();
    serve(null, false);
    expect(await ogPhoto("https://x/missing.png", { width: 10, height: 10 })).toBeNull();
    serve(Buffer.from("not an image"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await ogPhoto("https://x/junk.png", { width: 10, height: 10 })).toBeNull();
    spy.mockRestore();
  });
});
