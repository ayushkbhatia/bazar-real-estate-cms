import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { LEGACY_LANG_PARAM } from "@/lib/legacy-redirects";
import { LANG_PARAM } from "@/app/[locale]/(admin)/admin/content-assets/_lang-toggle";

/**
 * The CMS language toggle, as a routing test.
 *
 * The first build of it shipped `?lang=ar`, which is Polylang's parameter from
 * the WordPress site — `proxy.ts` deletes that one and 308s. So every Arabic
 * button in content assets bounced straight back to English, and because a 308
 * is cached by the browser forever, the URLs stayed dead after the server was
 * fixed. Nothing caught it: no test in this repo drove the proxy, and a query
 * parameter is invisible to the route baseline.
 *
 * Two assertions, and they are different claims. The first is that the toggle's
 * parameter is not the poisoned one, by construction. The second is that the
 * proxy leaves the CMS alone — WordPress never served `/admin`, so there is no
 * legacy URL of that shape to clean up, and the strip only sets the trap again.
 */

// The proxy reaches for a Supabase session on any path it does not bounce
// first; the branches under test return before that, and the pass-through
// case must not make a network call to prove it passed through.
vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(() => {
    const res = NextResponse.next();
    res.headers.set("x-test-passthrough", "1");
    return res;
  }),
}));

const { proxy } = await import("./proxy");

function get(url: string) {
  return proxy(new NextRequest(new URL(url, "https://bazar.test")));
}

describe("the CMS language parameter", () => {
  it("is not the parameter the proxy strips", () => {
    // If these ever converge, every Arabic button in content assets dies.
    expect(LANG_PARAM).not.toBe(LEGACY_LANG_PARAM);
  });

  it("survives a request to the CMS", async () => {
    const res = await get(`/admin/content-assets?${LANG_PARAM}=ar`);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-test-passthrough")).toBe("1");
  });

  it("leaves even ?lang= alone inside the CMS, so the trap cannot be re-set", async () => {
    const res = await get(`/admin/content-assets?${LEGACY_LANG_PARAM}=ar`);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still strips ?lang= on the public site, which is what it is for", async () => {
    const res = await get(`/buy?${LEGACY_LANG_PARAM}=ar`);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://bazar.test/ar/buy");
  });
});
