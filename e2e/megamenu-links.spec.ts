import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Sprint 15 Phase 5: forcing function against megamenu drift.
 *
 * Reads every href the public megamenu can show (column items, featured
 * tiles, and direct-link tabs) directly from the published rows in
 * Supabase, then hits each one through the running app and asserts it
 * doesn't 404.
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

type HrefRow = { href: string };

test("every megamenu link returns a non-404 response", async ({ request }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(
    !url || !anonKey,
    "Supabase env vars not set — megamenu link audit requires DB access",
  );

  const sb = createClient(url!, anonKey!);

  // Pull every href surface — RLS already filters to published-only.
  // Direct-link tabs (Insights, About) have `has_panel = false` and store
  // the href on the tab row itself; tabs with a panel use the panel
  // contents (items + featured tiles).
  const [itemsRes, tilesRes, tabsRes] = await Promise.all([
    sb.from("megamenu_items").select("href"),
    sb.from("megamenu_featured_tiles").select("href"),
    sb.from("megamenu_tabs").select("href").not("href", "is", null),
  ]);

  expect(itemsRes.error, "fetching megamenu_items failed").toBeNull();
  expect(tilesRes.error, "fetching megamenu_featured_tiles failed").toBeNull();
  expect(tabsRes.error, "fetching megamenu_tabs failed").toBeNull();

  const hrefs = new Set<string>(
    [
      ...(itemsRes.data as HrefRow[] | null ?? []),
      ...(tilesRes.data as HrefRow[] | null ?? []),
      ...(tabsRes.data as HrefRow[] | null ?? []),
    ]
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
