import { test, expect } from "@playwright/test";

test("/pages/about renders the seeded about page", async ({ page }) => {
  await page.goto("/pages/about");
  // /pages/<slug> is the generic block builder — every heading here is
  // editor-owned. Assert the page renders with a headline; the block
  // structure below is what this spec is really for.
  await expect(
    page.getByRole("heading", { level: 1 }).first(),
  ).toBeVisible();
  // Grid block surfaces 3 items
  await expect(page.getByRole("heading", { name: /fiduciary advisory/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /off-market access/i })).toBeVisible();
  // Banner CTA links to /contact
  const cta = page.getByRole("link", { name: /open a brief/i });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/contact");
});

test("/pages/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/pages/does-not-exist");
  expect(response?.status()).toBe(404);
});

test("admin /admin/pages redirects anon to staff login", async ({ page }) => {
  await page.goto("/admin/pages");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("/pages/about exposes meta description from SEO", async ({ page }) => {
  await page.goto("/pages/about");
  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveAttribute(
    "content",
    /twelve-advisor boutique/i,
  );
});
