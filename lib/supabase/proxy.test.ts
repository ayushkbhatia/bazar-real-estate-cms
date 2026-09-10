import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rewrite has to survive a Supabase token refresh.
 *
 * `updateSession` mints its response twice: once up front, and again inside
 * the `setAll` cookie callback that Supabase invokes only when it rotates the
 * session. If the second one is a plain `NextResponse.next()`, the locale
 * rewrite is silently dropped — the visitor lands on `/buy` with `[locale]`
 * resolved to `"buy"`, i.e. the home page, and only while signed in.
 *
 * Nothing in the e2e suite reaches this branch: `hasSupabaseSession`
 * short-circuits anonymous visitors before the Supabase client is constructed,
 * and every existing spec is anonymous. So it is unit-tested here, at the
 * seam, rather than pretended about.
 */

const setAllRef: { current: ((c: CookieToSet[]) => void) | null } = {
  current: null,
};

type CookieToSet = { name: string; value: string; options?: object };

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { setAll: (c: CookieToSet[]) => void } },
  ) => {
    setAllRef.current = opts.cookies.setAll;
    return {
      auth: {
        getClaims: async () => {
          // Simulate the rotation: `getClaims` goes through `getSession`,
          // which writes refreshed cookies when the access token is stale —
          // and that is exactly when the response gets re-minted.
          setAllRef.current?.([
            { name: "sb-test-auth-token", value: "rotated", options: {} },
          ]);
          return { data: { claims: { sub: "staff-1" } }, error: null };
        },
        // The proxy must verify the JWT locally, not ask the Auth server:
        // that round-trip is to the database's region and sat on the critical
        // path of every admin request. Throwing here fails the suite if
        // anyone reaches for `getUser()` in this file again. The real gate,
        // in the admin layout, still calls it — that is a different file.
        getUser: async () => {
          throw new Error(
            "proxy must not call auth.getUser() — use getClaims() (local JWT verification)",
          );
        },
      },
    };
  },
}));

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  },
}));

const { updateSession } = await import("./proxy");

function signedInRequest(url: string): NextRequest {
  const request = new NextRequest(new URL(url, "https://bazar.test"));
  // Any `sb-` cookie is what makes updateSession take the full refresh path.
  request.cookies.set("sb-test-auth-token", "existing");
  return request;
}

describe("updateSession response factory", () => {
  beforeEach(() => {
    setAllRef.current = null;
  });

  it("preserves a rewrite across a cookie rotation", async () => {
    const response = await updateSession(signedInRequest("/buy"), (req) => {
      const url = req.nextUrl.clone();
      url.pathname = "/en/buy";
      return NextResponse.rewrite(url, { request: req });
    });

    // Guard the guard: if the Supabase client were never constructed, the
    // rotation branch would not run and the assertion below would pass for
    // the wrong reason — which is exactly what happened the first time this
    // test was written.
    expect(
      setAllRef.current,
      "the mocked Supabase client was never constructed, so this test proves nothing",
    ).not.toBeNull();

    // If the factory were ignored on re-mint, this header would be absent and
    // /buy would render the home page for signed-in staff.
    expect(response.headers.get("x-middleware-rewrite")).toContain("/en/buy");
  });

  it("still sets the rotated cookies on the rewritten response", async () => {
    const response = await updateSession(signedInRequest("/buy"), (req) => {
      const url = req.nextUrl.clone();
      url.pathname = "/en/buy";
      return NextResponse.rewrite(url, { request: req });
    });

    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("rotated");
  });

  it("defaults to a pass-through response when no factory is given", async () => {
    const response = await updateSession(signedInRequest("/api/health"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
