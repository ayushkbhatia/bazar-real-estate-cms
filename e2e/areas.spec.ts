import { test, expect } from "@playwright/test";

// Headline copy on the master pages is CMS-owned since #222 — asserting the
// literal turns a routine copy edit into a red build. Assert that an h1
// renders; the page <title> stays hardcoded, so that assertion is still safe.

test("public /areas renders the neighbourhood index", async ({ page }) => {
  await page.goto("/areas");
  await expect(
    page.getByRole("heading", { level: 1 }).first(),
  ).toBeVisible();
  // At least one area card should link into /areas/<slug>
  await expect(page.locator("a[href^='/areas/']").first()).toBeVisible();
});

test("/areas/saadiyat-island renders the area guide", async ({ page }) => {
  await page.goto("/areas/saadiyat-island");
  // Pin to the h1; the page also has h2s like "Properties for sale in
  // Saadiyat Island" that would otherwise trip Playwright's strict-mode
  // multi-match check.
  await expect(
    page.getByRole("heading", { level: 1, name: /saadiyat island/i }),
  ).toBeVisible();

  // These run against the live CMS, so the assertions have to survive an
  // editor's copy change and the market-statistics band being either the
  // editorial figures typed into the CMS or the medians on the guide record.
  await expect(
    page.getByText(/median apt \/ ft²|sale price index/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /properties for sale/i }).first(),
  ).toBeVisible();
  // Deliberately nothing on the map band. Its heading is CMS-owned — this area
  // currently overrides it to "Location" — and the band hides itself for an
  // area with no coordinates, so any assertion on it is a copy edit away from
  // reddening main.
});

test("public /areas indexes every area, not just the card grid", async ({
  page,
}) => {
  await page.goto("/areas");
  // The curated grid is eight cards plus two spotlights. The A–Z directory
  // below them lists the whole catalogue, which is what makes an area added
  // in the CMS reachable — assert on the count rather than the CMS-owned
  // heading copy.
  const links = page.locator("a[href^='/areas/']");
  expect(await links.count()).toBeGreaterThan(15);
});

test("/areas/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/areas/this-area-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("/communities legacy URLs permanently redirect to /areas", async ({
  page,
}) => {
  await page.goto("/communities");
  expect(new URL(page.url()).pathname).toBe("/areas");

  await page.goto("/communities/saadiyat-island");
  expect(new URL(page.url()).pathname).toBe("/areas/saadiyat-island");
});
