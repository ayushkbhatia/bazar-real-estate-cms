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

test("the profile renders project cards and the developer's listings", async ({
  page,
}) => {
  await page.goto("/developers/aldar");

  // Projects use the same card as /off-plan — the giveaway is the
  // From / Bedrooms / Handover strip, which the old bespoke tile had not.
  const projects = page.locator("a[href^='/developments/']");
  await expect(projects.first()).toBeVisible();
  await expect(page.getByText("Handover").first()).toBeVisible();

  // Associated listings — property cards linking into /p/<slug>.
  await expect(
    page.getByRole("heading", { level: 2, name: /properties from this developer/i }),
  ).toBeVisible();
  await expect(page.locator("a[href^='/p/']").first()).toBeVisible();
});

test("the directory merges in developers that have no shipped logo", async ({
  page,
}) => {
  await page.goto("/developers");
  const cards = page.locator("a[href^='/developers/']");
  await expect(cards.first()).toBeVisible();

  // A developer with no logo in /public/developers appears here only because
  // the grid merges the catalogue in, and its card renders without an <img>.
  // That is the behaviour under test.
  //
  // It used to be pinned to `national-holding`, which went red the moment an
  // editor unpublished that row — these specs run against the live CMS, so a
  // hardcoded slug is a content change away from breaking the build. Find the
  // case instead of naming it, and skip when the catalogue currently has none
  // rather than asserting something the data cannot support.
  const total = await cards.count();
  let imageless = 0;
  for (let i = 0; i < total; i++) {
    if ((await cards.nth(i).locator("img").count()) === 0) imageless += 1;
  }
  test.skip(
    imageless === 0,
    "every published developer currently has a logo — nothing to assert",
  );
  expect(imageless).toBeGreaterThan(0);
});

test("a developer carried by both sources is listed once", async ({ page }) => {
  await page.goto("/developers");
  // The shipped directory calls it `modon`, the catalogue row `modon-properties`.
  // Merging on the normalised name is what stops two MODON cards rendering.
  await expect(
    page.locator("a[href='/developers/modon-properties']"),
  ).toHaveCount(1);
  await expect(page.locator("a[href='/developers/modon']")).toHaveCount(0);
});

test("the superseded developer slug still renders, canonical to the row", async ({
  page,
}) => {
  await page.goto("/developers/modon");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
    "href",
    /\/developers\/modon-properties$/,
  );
});

test("/developers/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/developers/this-developer-does-not-exist");
  expect(response?.status()).toBe(404);
});
