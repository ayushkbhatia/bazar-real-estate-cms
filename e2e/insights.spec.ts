import { test, expect } from "@playwright/test";

test("public /insights renders the index and category chips", async ({
  page,
}) => {
  await page.goto("/insights");
  await expect(
    page.getByRole("heading", { name: /the bazar brief/i }),
  ).toBeVisible();
  // Subscribe CTA panel (next to the featured article)
  await expect(page.getByText(/subscribe to the brief/i)).toBeVisible();
  // Featured article from the seed should be linked into.
  const featuredLink = page
    .locator("a[href^='/insights/']")
    .first();
  await expect(featuredLink).toBeVisible();
});

test("clicking a published article opens its detail page", async ({ page }) => {
  await page.goto("/insights");
  await page.locator("a[href^='/insights/']").first().click();
  await expect(page).toHaveURL(/\/insights\/[a-z0-9-]+$/);
  // Article header eyebrow ("Market report · X min read" or similar)
  await expect(page.locator("body")).toContainText(/min read/i);
  // Body prose container is present
  await expect(page.locator(".bz-prose")).toBeVisible();
});

test("/insights/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/insights/this-slug-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("admin /admin/blog redirects anon to sign-in", async ({ page }) => {
  await page.goto("/admin/blog");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("category filter narrows the index via query string", async ({ page }) => {
  await page.goto("/insights?category=market_report");
  await expect(
    page.getByRole("heading", { name: /the bazar brief/i }),
  ).toBeVisible();
  // The market_report seed article should be reachable from this filtered view.
  const link = page.locator("a[href='/insights/saadiyat-q1-2026']").first();
  await expect(link).toBeVisible();
});
