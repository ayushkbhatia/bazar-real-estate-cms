import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * The proxy hands the locale to the render as `X-NEXT-INTL-LOCALE`.
 *
 * A client-side navigation re-renders only the segments that changed, so the
 * `[locale]` layout's `setRequestLocale` does not run on it, and next-intl
 * resolves the locale from this header instead. Before it was set, every
 * filter click on `/ar/buy/search` re-rendered the page in English.
 *
 * Next.js forwards an overridden request header to the render as
 * `x-middleware-request-<name>` on the proxy's response, which is what these
 * assertions read.
 */

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(
    (req: NextRequest, make?: (r: NextRequest) => NextResponse) =>
      make ? make(req) : NextResponse.next(),
  ),
}));

const { proxy } = await import("./proxy");

function get(url: string, headers?: Record<string, string>) {
  return proxy(
    new NextRequest(new URL(url, "https://bazar.test"), { headers }),
  );
}

const forwarded = (res: Response) =>
  res.headers.get("x-middleware-request-x-next-intl-locale");

describe("locale request header", () => {
  it("carries ar on an Arabic page, including an RSC navigation", async () => {
    expect(forwarded(await get("/ar/buy/search?type=villa"))).toBe("ar");
    expect(
      forwarded(
        await get("/ar/buy/search?type=villa&baths=2&_rsc=abc", { RSC: "1" }),
      ),
    ).toBe("ar");
  });

  it("carries en on an unprefixed page, alongside the rewrite to /en", async () => {
    const res = await get("/buy/search?type=villa");
    expect(forwarded(res)).toBe("en");
    expect(res.headers.get("x-middleware-rewrite")).toContain("/en/buy/search");
  });

  it("cannot be chosen by the browser", async () => {
    const res = await get("/ar/rent/search", { "X-NEXT-INTL-LOCALE": "en" });
    expect(forwarded(res)).toBe("ar");
  });

  it("keeps the rest of the request's headers", async () => {
    const res = await get("/ar/buy/search", { cookie: "a=1" });
    expect(res.headers.get("x-middleware-request-cookie")).toBe("a=1");
  });
});
