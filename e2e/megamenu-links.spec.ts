import { test, expect } from "@playwright/test";

/**
 * Sprint 15 Phase 5: forcing function against megamenu drift.
 *
 * Reads every href the public megamenu can show (column items, featured
 * tiles, and direct-link tabs) directly from Supabase's REST endpoint,
 * then hits each one through the running app and asserts it doesn't 404.
 *
 * Why direct REST rather than the supabase-js client: the JS client
 * initialises a Realtime WebSocket connection on construction, which
 * fails on the Node 20 CI runner ("Node.js 20 detected without native
 * WebSocket support"). The REST endpoint speaks plain HTTP — Playwright's
 * `request` fixture handles it directly and the dependency is one we
 * already trust.
 *
 * Why DB-based and not DOM-based: Radix lazy-mounts NavigationMenuContent
 * when its trigger activates, and Playwright's hover/click on the
 * triggers doesn't reliably fire the underlying onMouseEnter handlers
 * in headless Chromium. The DB is the source of truth for the menu
 * structure, so querying it directly is both faster and not subject to
 * Radix's interaction model.
 *
 * If someone adds a menu link that points at a non-existent page (typo'd
 * href, removed route, missing slug), this test fails. If they remove a
 * page that's still linked from the menu, this test fails. That's the
 * regression class the spec is here to catch.
 */

type HrefRow = { href: string | null };

test("every megamenu link returns a non-404 response", async ({ request }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(
    !url || !anonKey,
    "Supabase env vars not set — megamenu link audit requires DB access",
  );

  // Tiny REST-only helper: PostgREST treats every Supabase table as
  // `${url}/rest/v1/${table}?select=...`, and RLS gates the response so
  // we transparently see only published rows. `Prefer: count=exact` is
  // not needed — we just want the rows.
  const headers = {
    apikey: anonKey!,
    Authorization: `Bearer ${anonKey!}`,
    Accept: "application/json",
  };
  async function fetchHrefs(table: string, extraQs = ""): Promise<HrefRow[]> {
    const qs = extraQs ? `&${extraQs}` : "";
    const res = await request.get(
      `${url}/rest/v1/${table}?select=href${qs}`,
      { headers },
    );
    expect(res.ok(), `${table} fetch returned ${res.status()}`).toBe(true);
    return (await res.json()) as HrefRow[];
  }

  const [items, tiles, tabs] = await Promise.all([
    fetchHrefs("megamenu_items"),
    fetchHrefs("megamenu_featured_tiles"),
    fetchHrefs("megamenu_tabs", "href=not.is.null"),
  ]);

  const hrefs = new Set<string>(
    [...items, ...tiles, ...tabs]
      .map((r) => r.href)
      .filter((h): h is string => typeof h === "string" && h.startsWith("/")),
  );

  expect(
    hrefs.size,
    "expected the published megamenu to expose at least 30 internal links",
  ).toBeGreaterThan(30);

  // Hit each href in parallel through the running app and capture failures.
  // GET (not HEAD) because Next.js dynamic routes don't always implement
  // HEAD; maxRedirects=3 absorbs trailing-slash and locale redirects.
  const toCheck = [...hrefs];
  const results = await Promise.all(
    toCheck.map(async (href) => {
      const response = await request.get(href, { maxRedirects: 3 });
      return { href, status: response.status() };
    }),
  );

  const dead = results.filter((r) => r.status === 404);
  expect(
    dead,
    `Megamenu has dead links:\n${dead
      .map((f) => `  · ${f.href} → ${f.status}`)
      .join("\n")}`,
  ).toEqual([]);
});
