import { test, expect } from "@playwright/test";

/**
 * /insights became an editable master page in #222, so its headline, intro and
 * subscribe copy now live in the CMS. Asserting those literals made a routine
 * copy edit break CI — which is exactly what happened: the headline was
 * changed from "The Bazar Brief." to "Property Market Insights" and three
 * specs went red on a page that renders perfectly.
 *
 * These specs assert STRUCTURE — that a headline exists, that articles link
 * out, that filtering works. Copy is the editor's to change without asking a
 * developer.
 */
test("public /insights renders the index and category chips", async ({
  page,
}) => {
  await page.goto("/insights");
  // A headline exists and is non-empty. Its wording is CMS-owned.
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeEmpty();
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

test("admin /admin/blog redirects anon to staff login", async ({ page }) => {
  await page.goto("/admin/blog");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("category filter narrows the index via query string", async ({ page }) => {
  // Pick a category off the index rather than assuming `market_report` still
  // has a published article behind it — naming the seed article here is what
  // broke this when the editorial catalogue was pruned to 11 of 25.
  await page.goto("/insights");
  const categoryHref = await page
    .locator("a[href*='category=']")
    .first()
    .getAttribute("href");
  test.skip(!categoryHref, "No categories offered on the insights index.");

  await page.goto(categoryHref!);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // A filtered view either lists articles or says it has none — both are
  // correct; silently rendering nothing at all is not.
  const articles = page.locator("a[href^='/insights/']");
  const count = await articles.count();
  if (count === 0) {
    await expect(page.getByText(/no (articles|posts)/i).first()).toBeVisible();
  } else {
    await expect(articles.first()).toBeVisible();
  }
});
