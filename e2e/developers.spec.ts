import { test, expect } from "@playwright/test";

test("public /developers renders the directory", async ({ page }) => {
  await page.goto("/developers");
  await expect(
    page.getByRole("heading", { name: /who builds abu dhabi/i }),
  ).toBeVisible();
  // At least one developer card should link into /developers/<slug>
  await expect(page.locator("a[href^='/developers/']").first()).toBeVisible();
});

test("/developers/aldar renders the developer profile", async ({ page }) => {
  await page.goto("/developers/aldar");
  // Pin to the h1; the current developments grid may render h3s that mention
  // Aldar by name (e.g. "Aldar Mamsha Phase 2") which would otherwise trip
  // Playwright's strict-mode multi-match check.
  await expect(
    page.getByRole("heading", { level: 1, name: /aldar properties/i }),
  ).toBeVisible();
  await expect(page.getByText(/founded/i)).toBeVisible();
});

test("/developers/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/developers/this-developer-does-not-exist");
  expect(response?.status()).toBe(404);
});
