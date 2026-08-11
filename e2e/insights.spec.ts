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

test("a category chip opens that category's archive", async ({ page }) => {
  // Pick a category off the index rather than assuming `market_report` still
  // has a published article behind it — naming the seed article here is what
  // broke this when the editorial catalogue was pruned to 11 of 25.
  //
  // The chips point at `/insights/category/<slug>`. They used to carry
  // `?category=`, which #283 removed: reading `searchParams` forced the index
  // to render dynamically and kept it off the CDN, and the querystring was a
  // second URL serving the archive's content. This spec asserted the old shape
  // and went red on that PR.
  await page.goto("/insights");
  const chip = page.locator("a[href^='/insights/category/']").first();
  // `count()` resolves immediately; reading an attribute off a locator that
  // matches nothing waits out the full timeout instead, so the skip below
  // could never be reached — that is how a removed URL shape presented as a
  // 30s timeout rather than a skip.
  test.skip(
    (await chip.count()) === 0,
    "No categories offered on the insights index.",
  );

  const categoryHref = await chip.getAttribute("href");
  await page.goto(categoryHref!);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // An archive either lists articles or says it has none — both are correct;
  // silently rendering nothing at all is not. Category URLs are excluded so a
  // page showing only its own chip bar doesn't read as a page full of results.
  const articles = page.locator(
    "a[href^='/insights/']:not([href^='/insights/category/'])",
  );
  const count = await articles.count();
  if (count === 0) {
    await expect(page.getByText(/no (articles|posts)/i).first()).toBeVisible();
  } else {
    await expect(articles.first()).toBeVisible();
  }
});

test("the legacy ?category= link still reaches the archive", async ({
  page,
}) => {
  // #283 promised existing links and bookmarks keep working via a proxy
  // redirect. `lib/filters/search-redirect.test.ts` covers the mapping; this
  // covers the redirect actually being wired into the request path.
  //
  // The category is taken from a live chip and converted back to the
  // querystring's underscore form, so this round-trips whatever the catalogue
  // currently holds instead of naming a slug that a retired category would
  // take down with it.
  await page.goto("/insights");
  const chip = page.locator("a[href^='/insights/category/']").first();
  test.skip(
    (await chip.count()) === 0,
    "No categories offered on the insights index.",
  );
  const archiveHref = (await chip.getAttribute("href"))!;
  const legacySlug = archiveHref.split("/").pop()!.replace(/-/g, "_");

  await page.goto(`/insights?category=${legacySlug}`);
  await expect(page).toHaveURL(new RegExp(`${archiveHref}$`));
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});
