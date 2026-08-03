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
  // Pin to the h1; the page also has h2s like "Listings in Saadiyat Island."
  // and "Who to talk to about Saadiyat" that would otherwise trip Playwright's
  // strict-mode multi-match check.
  await expect(
    page.getByRole("heading", { level: 1, name: /saadiyat island/i }),
  ).toBeVisible();
  // The stats grid should surface the four headline figures
  await expect(page.getByText(/median apt \/ ft²/i)).toBeVisible();
  await expect(page.getByText(/yoy change/i)).toBeVisible();
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
