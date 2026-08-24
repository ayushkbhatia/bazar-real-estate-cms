import { test, expect } from "@playwright/test";

// Headline copy on the master pages is CMS-owned since #222 — asserting the
// literal turns a routine copy edit into a red build. Assert that an h1
// renders; the page <title> stays hardcoded, so that assertion is still safe.

// Coverage for the public marketing surface: /about, /agents +
// /agents/[slug], /services + its five sub-pages. All shipped pre-Sprint-2;
// these tests fill a gap in the existing e2e set (no spec covered them
// before).

test("/about renders with title set", async ({ page }) => {
  const response = await page.goto("/about");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/about bazar/i);
  await expect(
    page.getByRole("heading", { level: 1 }).first(),
  ).toBeVisible();
});

test("/agents renders with title set and lists advisors", async ({ page }) => {
  const response = await page.goto("/agents");
  expect(response?.status()).toBe(200);
  // `title` is a literal in the route's own `metadata` export, not a CMS
  // field, so it stays asserted by value — see the note at the top.
  await expect(page).toHaveTitle(/our team/i);

  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeEmpty();

  /*
   * The half this test is named for and never checked.
   *
   * It asserted the h1 read "Twelve advisors. By design." — the /agents
   * master page's CMS headline, and a number that goes stale the moment the
   * thirteenth advisor is hired. That the directory lists advisors at all was
   * never established; a page with the right headline and an empty grid
   * passed.
   */
  const advisors = page.locator("a[href^='/agents/']:not([href='/agents'])");
  expect(
    await advisors.count(),
    "/agents should link to at least one advisor",
  ).toBeGreaterThan(0);
});

test("/agents/[slug] resolves an advisor (seed-fallback safe)", async ({
  page,
  request,
}) => {
  // lib/queries/agents falls back to SEED_AGENTS when the staff table is
  // empty, so the directory is always populated. Grab the first agent link
  // and request the detail page.
  await page.goto("/agents");
  const directoryLinks = page.locator("a[href^='/agents/']:not([href='/agents'])");
  const count = await directoryLinks.count();
  expect(count, "/agents should expose at least one advisor link").toBeGreaterThan(0);

  const href = await directoryLinks.first().getAttribute("href");
  expect(href).toBeTruthy();
  if (!href) return;

  const response = await request.get(href);
  expect(response.status(), `expected 200 on ${href}`).toBe(200);
  const body = await response.text();
  expect(body).toMatch(/<title>[^<]+<\/title>/i);
});

test("/services renders with title set", async ({ page }) => {
  const response = await page.goto("/services");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/services/i);
  await expect(
    page.getByRole("heading", { level: 1 }).first(),
  ).toBeVisible();
});

test("each /services/* sub-page returns 200 with title", async ({ page }) => {
  for (const slug of ["sell", "buy", "manage", "conveyancing", "invest"]) {
    const response = await page.goto(`/services/${slug}`);
    expect(response?.status(), `expected 200 on /services/${slug}`).toBe(200);
    const title = await page.title();
    expect(
      title.length,
      `non-empty <title> on /services/${slug}`,
    ).toBeGreaterThan(0);
  }
});

test("/services/unknown 404s", async ({ page }) => {
  const response = await page.goto("/services/not-a-real-service");
  expect(response?.status()).toBe(404);
});
