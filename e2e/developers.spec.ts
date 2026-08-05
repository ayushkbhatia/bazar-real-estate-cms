import { test, expect } from "@playwright/test";

// /developers is an editable master page since #222 — the headline was
// changed to "Our Developer Partners Shaping the UAE" on 4 Aug. #225 made the
// other master-page specs copy-agnostic but missed this one. Assert an h1
// renders, not what it says.
test("public /developers renders the directory", async ({ page }) => {
  await page.goto("/developers");
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeEmpty();
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
  // The simplified profile leads with a "Developments" section; pin to its
  // "<developer>'s projects." heading rather than the removed stats block.
  await expect(
    page.getByRole("heading", { level: 2, name: /projects/i }),
  ).toBeVisible();
});

test("/developers/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/developers/this-developer-does-not-exist");
  expect(response?.status()).toBe(404);
});
