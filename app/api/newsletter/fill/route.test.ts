import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { FILL_HEIGHT, FILL_WIDTH } from "@/lib/newsletter/fill";
import { GET } from "./route";

const get = (q: string) => GET(new NextRequest(`https://www.bazarrealestate.ae/api/newsletter/fill?${q}`));

describe("GET /api/newsletter/fill", () => {
  it("draws a column fading from the first colour at the top to the second at the bottom", async () => {
    const res = await get("f=003452&t=005777");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([FILL_WIDTH, FILL_HEIGHT]);
    const at = (y: number) => [...data.subarray(y * info.width * info.channels, y * info.width * info.channels + 3)];
    expect(at(0)).toEqual([0x00, 0x34, 0x52]);
    expect(at(FILL_HEIGHT - 1)).toEqual([0x00, 0x57, 0x77]);
  });

  it("refuses anything but two hex colours", async () => {
    expect((await get("f=003452")).status).toBe(400);
    expect((await get("f=navy&t=005777")).status).toBe(400);
  });
});
