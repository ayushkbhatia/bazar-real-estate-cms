import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { ICON_PX } from "@/lib/newsletter/blocks/amenity-icons";
import { GET } from "./route";

const get = (q: string) => GET(new NextRequest(`https://www.bazarrealestate.ae/api/newsletter/icon?${q}`));

describe("GET /api/newsletter/icon", () => {
  it("draws a catalogued icon as a PNG in the colour asked, cached for a year", async () => {
    const res = await get("n=pool&c=FFFFFF");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    const png = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height]).toEqual([ICON_PX, ICON_PX]);
    // Some pixels are drawn (the stroke), most are transparent.
    const { channels } = await sharp(png).stats();
    expect(channels[3]!.max).toBe(255);
    expect(channels[3]!.min).toBe(0);
  });

  it("refuses an icon it doesn't have and anything but a hex colour", async () => {
    expect((await get("n=nope&c=FFFFFF")).status).toBe(400);
    expect((await get("n=pool&c=red")).status).toBe(400);
    expect((await get('n=pool&c=FFF"/><script>')).status).toBe(400);
    expect((await get("n=pool")).status).toBe(400);
  });
});
