import { test, expect } from "@playwright/test";

test("/insights/category/buyers-guide renders the filtered index", async ({
  page,
}) => {
  await page.goto("/insights/category/buyers-guide");
  // Pin to the h1 — article cards on this page render h2s that may also
  // contain "buyer" and would otherwise trip Playwright's strict-mode check.
  await expect(
    page.getByRole("heading", { level: 1, name: /buyer/i }),
  ).toBeVisible();
  // "All insights" crumb back to /insights
  const crumb = page.getByRole("link", { name: /all insights/i });
  await expect(crumb).toBeVisible();
  await expect(crumb).toHaveAttribute("href", "/insights");
});

test("/insights/category/<unknown> 404s", async ({ page }) => {
  const response = await page.goto(
    "/insights/category/this-category-does-not-exist",
  );
  expect(response?.status()).toBe(404);
});
