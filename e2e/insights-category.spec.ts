import { test, expect } from "@playwright/test";
import { firstCategoryPath } from "./_helpers";

test("a category archive renders the filtered index", async ({ page }) => {
  // The taxonomy became a runtime-editable table in #0055c, so naming
  // `buyers-guide` here made a retired category a red build. Take whichever
  // category the index currently offers.
  const path = await firstCategoryPath(page);
  test.skip(!path, "No categories offered on the insights index.");
  await page.goto(path!);

  // Pin to the h1 — article cards on this page render h2s that could also
  // match the category name and would trip Playwright's strict-mode check.
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeEmpty();
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
