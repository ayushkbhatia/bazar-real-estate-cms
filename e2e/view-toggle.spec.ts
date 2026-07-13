import { test, expect } from "@playwright/test";

/**
 * Regression: the grid/list/map toggle must switch the rendered view
 * immediately, without a manual page refresh. `SearchList` is a server
 * component that branches on the `view` search param, so `ViewToggle` must
 * use nuqs `shallow: false` to re-fetch the RSC on change (matching
 * SortDropdown / FilterBar). A shallow URL update leaves the server view
 * stale until reload — the bug this guards.
 */
test("view toggle switches grid → map → list without a refresh", async ({
  page,
}) => {
  await page.goto("/buy/search");

  // Default grid view shows property-card links; map view replaces them with
  // pins. If the DB has no listings, there's nothing to switch — skip.
  const cardCount = await page.locator("a[href^='/p/']").count();
  test.skip(cardCount === 0, "no seeded listings to render a view");

  // → Map: URL updates and the card grid is replaced by the map (0 card links).
  await page.getByRole("radio", { name: "Map" }).click();
  await expect(page).toHaveURL(/[?&]view=map\b/);
  await expect(page.locator("a[href^='/p/']")).toHaveCount(0);

  // → List: cards come back (no full reload needed).
  await page.getByRole("radio", { name: "List" }).click();
  await expect(page).toHaveURL(/[?&]view=list\b/);
  await expect(page.locator("a[href^='/p/']").first()).toBeVisible();
});
