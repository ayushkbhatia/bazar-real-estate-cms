import { test, expect, devices } from "@playwright/test";

/**
 * Search results default to grid on desktop and list on a phone.
 *
 * The choice is made server-side from the request's user agent (`lib/device.ts`),
 * because `SearchList` renders one view's markup or the other's — a client-side
 * correction would paint the desktop layout on a phone and then swap it. That
 * makes the UA the thing under test, so these specs set a device rather than
 * just a viewport.
 *
 * `/off-plan/search` is the subject because off-plan is what the catalogue
 * reliably holds (see `e2e/_helpers.ts`).
 */

const SEARCH = "/off-plan/search";

/**
 * `devices[…]` carries `defaultBrowserType`, which Playwright refuses inside a
 * `describe` because it would force a new worker. The rest of the descriptor —
 * user agent, viewport, touch — is what we actually want, and it runs fine on
 * the config's chromium project.
 */
const { defaultBrowserType: _ignored, ...IPHONE } = devices["iPhone 13"];

/** Row cards (list view) vs stacked cards (grid view), as ListingCard builds them. */
const ROW_CARD = "article.flex-row";
const STACKED_CARD = "article.flex-col";

test.describe("phone", () => {
  test.use(IPHONE);

  test("defaults to list, and Grid is still reachable", async ({ page }) => {
    await page.goto(SEARCH);

    const cards = await page.locator("a[href^='/p/']").count();
    test.skip(cards === 0, "no seeded listings to render a view");

    // No `view` param, yet list is what rendered and what the toggle shows.
    expect(new URL(page.url()).searchParams.has("view")).toBe(false);
    await expect(page.locator(ROW_CARD).first()).toBeVisible();
    await expect(page.getByRole("radio", { name: "List" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // The row card must fit a 390px viewport. It hard-codes a 280px media
    // column at desktop widths, and before the breakpoint override that
    // pushed the page into horizontal scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, "list view must not scroll horizontally on a phone").toBe(
      false,
    );

    // Grid has to write the param explicitly here. If it cleared `view` the
    // way it does on desktop, the server would re-apply the phone default and
    // the button would do nothing.
    await page.getByRole("radio", { name: "Grid" }).click();
    await expect(page).toHaveURL(/[?&]view=grid\b/);
    await expect(page.locator(STACKED_CARD).first()).toBeVisible();

    // Back to the default: the param goes away rather than being pinned.
    await page.getByRole("radio", { name: "List" }).click();
    await expect(page).not.toHaveURL(/[?&]view=/);
    await expect(page.locator(ROW_CARD).first()).toBeVisible();
  });
});

test.describe("desktop", () => {
  // No `test.use` — the config's project is already Desktop Chrome.

  test("still defaults to grid", async ({ page }) => {
    await page.goto(SEARCH);

    const cards = await page.locator("a[href^='/p/']").count();
    test.skip(cards === 0, "no seeded listings to render a view");

    await expect(page.locator(STACKED_CARD).first()).toBeVisible();
    await expect(page.getByRole("radio", { name: "Grid" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("honours a ?view=list link shared from a phone", async ({ page }) => {
    await page.goto(`${SEARCH}?view=list`);

    const cards = await page.locator("a[href^='/p/']").count();
    test.skip(cards === 0, "no seeded listings to render a view");

    await expect(page.locator(ROW_CARD).first()).toBeVisible();
  });
});
