import { test, expect } from "@playwright/test";

test("home → /buy → property detail", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /find a home worth keeping/i }),
  ).toBeVisible();

  // Featured listings come from Supabase. If they're not present, the page
  // shows a placeholder — we tolerate that locally and only assert on the
  // CTA, then navigate to /buy via the "Browse the marketplace" button.
  await page.getByRole("link", { name: /browse the marketplace/i }).click();
  await expect(page).toHaveURL(/\/buy$/);
  await expect(
    page.getByRole("heading", { name: /properties for sale/i }),
  ).toBeVisible();

  // Click into the first listing card.
  const firstCard = page
    .locator("a[href^='/p/']")
    .first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();

  // Property detail should display the canonical reference at least once.
  await expect(page).toHaveURL(/\/p\/[a-z0-9-]+-baz-[a-z]+-\d+$/);
  await expect(page.locator("text=/BAZ-[A-Z]+-\\d+/").first()).toBeVisible();
});

test("invalid property reference 404s", async ({ page }) => {
  const response = await page.goto("/p/garbage");
  expect(response?.status()).toBe(404);
});

test("admin gating redirects anon to sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("filter bar narrows the result set via URL state", async ({ page }) => {
  await page.goto("/buy");
  // Beds filter — click "3 beds" (aria-label distinguishes from the baths button).
  await page.getByRole("button", { name: "3 beds" }).click();

  // URL should reflect the filter
  await expect(page).toHaveURL(/[?&]beds=3\b/);

  // Result count shows the active filter summary
  await expect(page.getByText(/3\+ beds/i)).toBeVisible();

  // At least one card still rendered (seeded data has a 3-bed match)
  await expect(page.locator("a[href^='/p/']").first()).toBeVisible();

  // Clear filters returns us to base state
  await page.getByRole("button", { name: /clear 1 filter/i }).click();
  await expect(page).not.toHaveURL(/beds=3/);
});
