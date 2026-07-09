import { test, expect } from "@playwright/test";

test("public /communities renders the neighbourhood index", async ({
  page,
}) => {
  await page.goto("/communities");
  await expect(
    page.getByRole("heading", {
      name: /leading communities/i,
      level: 1,
    }),
  ).toBeVisible();
  // At least one community row should link into /communities/<slug>
  await expect(page.locator("a[href^='/communities/']").first()).toBeVisible();
});

test("/communities/saadiyat-island renders the community guide", async ({
  page,
}) => {
  await page.goto("/communities/saadiyat-island");
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

test("/communities/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/communities/this-area-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("/areas legacy URLs permanently redirect to /communities", async ({
  page,
}) => {
  await page.goto("/areas");
  expect(new URL(page.url()).pathname).toBe("/communities");

  await page.goto("/areas/saadiyat-island");
  expect(new URL(page.url()).pathname).toBe("/communities/saadiyat-island");
});
