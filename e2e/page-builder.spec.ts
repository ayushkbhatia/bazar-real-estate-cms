import { test, expect } from "@playwright/test";

/**
 * Page builder — the public and anonymous halves.
 *
 * These specs deliberately name no campaign slug. A landing page is *designed*
 * to be unpublished when the campaign ends, so a spec that hard-codes one is a
 * red CI with no commit behind it — the exact trap `e2e/_helpers.ts` documents.
 * Everything here either asserts on a route that always exists, or discovers
 * its subject from what the site itself is advertising.
 *
 * The authoring flow (create → reorder → save → preview → publish) needs a
 * staff session, which CI has no service-role creds to seed. It is covered by
 * the manual checklist in the PR instead, and by the unit specs in
 * lib/page-builder/*.test.ts, which hold the parts that can go silently wrong.
 */

test("/lp/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/lp/no-such-campaign-xyz");
  expect(response?.status()).toBe(404);
});

test("a landing slug can't smuggle a second path segment", async ({ page }) => {
  // /lp/[slug] is one dynamic segment. The slug regex and the 0099 CHECK both
  // forbid a slash, so nothing should ever resolve here.
  const response = await page.goto("/lp/spring/launch");
  expect(response?.status()).toBe(404);
});

test("/admin/page-builder redirects anon to staff login", async ({ page }) => {
  await page.goto("/admin/page-builder");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("the preview route is behind the same gate", async ({ page }) => {
  // Preview reads unpublished content, so it must never be reachable without a
  // staff session — that is why it lives under (admin) rather than on a token
  // URL.
  await page.goto("/admin/page-builder/00000000-0000-0000-0000-000000000000/preview");
  await expect(page).toHaveURL(/\/admin\/login/);
});

/** Landing pages the sitemap is currently advertising, if any. */
async function publishedLandingPaths(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
): Promise<string[]> {
  const response = await request.get(`${baseURL}/sitemap.xml`);
  if (!response.ok()) return [];
  const xml = await response.text();
  return [...xml.matchAll(/<loc>[^<]*?(\/lp\/[a-z0-9-]+)<\/loc>/g)].map(
    (m) => m[1],
  );
}

test("every advertised landing page renders with one h1", async ({
  page,
  request,
  baseURL,
}) => {
  const paths = await publishedLandingPaths(request, baseURL ?? "");
  test.skip(paths.length === 0, "No landing pages published yet.");

  for (const path of paths.slice(0, 5)) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should resolve`).toBe(200);

    // Exactly one — the publish gate enforces it, and axe reports two as a
    // heading-order violation against production.
    await expect(page.locator("h1"), path).toHaveCount(1);

    // The slug is one segment, so the URL must contain no encoded slash.
    expect(page.url()).not.toContain("%2F");
  }
});

test("a landing page never scrolls sideways on a phone", async ({
  page,
  request,
  baseURL,
}) => {
  const paths = await publishedLandingPaths(request, baseURL ?? "");
  test.skip(paths.length === 0, "No landing pages published yet.");

  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of paths.slice(0, 5)) {
    await page.goto(path);
    // The catalogue is a curation of already-audited sections and the renderer
    // wraps them in `overflow-x-clip [&>*]:min-w-0`, so one runaway grid track
    // can't take the page with it. This is the assertion that keeps that true
    // when a new block is added.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
  }
});

test("a no-index landing page stays out of the sitemap", async ({
  request,
  baseURL,
}) => {
  const paths = await publishedLandingPaths(request, baseURL ?? "");
  test.skip(paths.length === 0, "No landing pages published yet.");

  // Whatever the sitemap advertises must not itself say noindex — that
  // combination is the soft-404 signal we're avoiding.
  const response = await request.get(`${baseURL}${paths[0]}`);
  const html = await response.text();
  expect(html).not.toMatch(/<meta name="robots"[^>]*noindex/i);
});
