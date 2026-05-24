import { test, expect } from "@playwright/test";

test("public /areas renders the neighbourhood index", async ({ page }) => {
  await page.goto("/areas");
  await expect(
    page.getByRole("heading", { name: /neighbourhood by neighbourhood/i }),
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
