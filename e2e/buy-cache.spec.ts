import { test, expect } from "@playwright/test";

// Sprint 2 · T1 cache check.
//
// /about is statically prerendered (no Supabase calls, no searchParams) so
// the second request demonstrably hits Next.js's static cache. /buy reads
// `searchParams` and therefore renders on demand even with revalidate=60,
// but the win there is at the data-fetch layer: getSessionUser() and
// getSavedPropertyIds() no longer execute on the SSR path.
//
// Local `next start` exposes the runtime cache header as `X-Nextjs-Cache`.
// On Vercel it surfaces as `X-Vercel-Cache`. Accept either.

test("/about serves a cached response on the second request", async ({
  request,
}) => {
  const warm = await request.get("/about");
  expect(warm.status()).toBe(200);

  const probe = await request.get("/about");
  expect(probe.status()).toBe(200);

  const headers = probe.headers();
  const cacheHeader = (
    headers["x-vercel-cache"] ??
    headers["x-nextjs-cache"] ??
    ""
  ).toUpperCase();

  expect(
    ["HIT", "STALE", "REVALIDATED"],
    `expected /about to indicate a cache hit; got '${cacheHeader || "<no cache header>"}'`,
  ).toContain(cacheHeader);
});

test("/buy/search renders anonymously without an auth round-trip", async ({
  request,
}) => {
  // /buy/search is deliberately dynamic — it reads `searchParams`, which is
  // the whole point of a search route, so it can never be cached. What this
  // guards is the data layer: the per-user SSR fetches were lifted to the
  // client, so an anonymous GET must not touch Supabase Auth.
  // (Search relocated from /buy to /buy/search.)
  const a = await request.get("/buy/search");
  expect(a.status()).toBe(200);
  const b = await request.get("/buy/search");
  expect(b.status()).toBe(200);

  // The page rendered without any user session — assert that the response
  // body doesn't crash, and that the response header doesn't claim to need
  // a Supabase auth-token cookie refresh (which would indicate per-user
  // state was rendered server-side).
  const setCookie = b.headers()["set-cookie"];
  expect(
    setCookie ?? "",
    "anon GET /buy/search should not refresh an auth cookie",
  ).not.toMatch(/sb-[^=]+-auth-token/);
});
