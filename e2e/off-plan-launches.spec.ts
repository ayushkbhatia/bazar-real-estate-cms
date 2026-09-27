import { test, expect, type Page } from "@playwright/test";

/**
 * /off-plan/launches — every published project, three to a row on a desktop
 * and two on a phone.
 *
 * These run against the live CMS, so they assert the page's shape and never
 * its content: no project is named, no count is expected, and a spec whose
 * data is not there (nothing published, the rail switched off) skips with a
 * reason instead of failing on an editor's decision. The phone layout's
 * geometry — tracks, clipping, touch targets — is e2e/mobile-geometry.spec.ts's
 * job; this file checks the page does what it is for.
 */

const GRID = '[data-testid="launches-grid"]';

/*
 * A Link click commits its URL only once that route's prefetch has landed, and
 * the prefetch renders against the live database. Measured locally with a
 * slow Supabase: the click's own request answered in 375ms and the URL still
 * waited 11s behind the prefetch. A broken link fails either way; this only
 * stops a slow database reading as one.
 */
const NAVIGATION = { timeout: 20_000 };

/** Columns the grid is actually drawing, read from the computed template. */
async function columns(page: Page): Promise<number> {
  return page
    .locator(GRID)
    .evaluate(
      (el) =>
        getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean)
          .length,
    );
}

async function openLaunches(page: Page): Promise<number> {
  await page.goto("/off-plan/launches");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return page.locator(`${GRID} > li > a[href^="/developments/"]`).count();
}

test("the New Projects rail's view-all link opens every launch", async ({
  page,
}) => {
  await page.goto("/off-plan");
  // Skip on the rail's absence, never on the link's: a rail that renders
  // without this link is exactly the regression the spec exists to catch.
  test.skip(
    (await page.locator('[data-testid^="carousel-track-"]').count()) === 0,
    "The New Projects rail is not rendering — no placed projects, or its section is hidden.",
  );
  const link = page.locator('a[href="/off-plan/launches"]').first();
  await expect(link).toBeVisible();

  await link.click();
  await expect(page).toHaveURL(/\/off-plan\/launches$/, NAVIGATION);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("every card links to its project page, three to a row on a desktop", async ({
  page,
}) => {
  const cards = await openLaunches(page);
  test.skip(cards === 0, "No published developments in the CMS.");

  expect(await columns(page)).toBe(3);
  // One card per project: the list is server-rendered once, with nothing
  // duplicated for a second breakpoint.
  const hrefs = await page
    .locator(`${GRID} > li > a`)
    .evaluateAll((links) => links.map((l) => l.getAttribute("href")));
  expect(new Set(hrefs).size).toBe(hrefs.length);
});

test("two to a row on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cards = await openLaunches(page);
  test.skip(cards === 0, "No published developments in the CMS.");

  expect(await columns(page)).toBe(2);
});

test("the back link returns to New Projects", async ({ page }) => {
  await openLaunches(page);
  // Inside <main>: the site nav above it links to /off-plan too.
  const back = page.locator('main header a[href="/off-plan"]').first();
  test.skip(
    (await back.count()) === 0,
    "The back link's label has been cleared in the CMS.",
  );

  await back.click();
  await expect(page).toHaveURL(/\/off-plan$/, NAVIGATION);
});
