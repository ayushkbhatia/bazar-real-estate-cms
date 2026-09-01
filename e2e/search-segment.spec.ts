import { test, expect } from "@playwright/test";

/**
 * The residential / commercial toggle above the search results.
 *
 * It replaced a four-pill Buy · Rent · Off-plan · Commercial strip that
 * navigated between the four `…/search` routes. That strip asked the visitor
 * for the transaction they had already chosen in the nav, and it offered
 * "Commercial" as a fourth alternative to Buy and Rent — which it is not. A
 * commercial unit is for sale or to let like any other, so the segment belongs
 * on every mode, as a filter.
 *
 * Written against `/buy/search` because it is the route with published stock;
 * the control is the same component on all three.
 */

test("the toggle starts unset, so an unfiltered search shows both", async ({
  page,
}) => {
  await page.goto("/buy/search");
  for (const name of ["Residential", "Commercial"]) {
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  }
});

test("pressing a segment filters in place, keeping the route", async ({
  page,
}) => {
  await page.goto("/buy/search");
  await page.getByRole("button", { name: "Residential", exact: true }).click();

  await expect(page).toHaveURL(/\/buy\/search\?.*segment=residential/);
  await expect(
    page.getByRole("button", { name: "Residential", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // The route is the transaction axis and the toggle must not move it.
  expect(new URL(page.url()).pathname).toBe("/buy/search");
});

test("pressing the pressed segment clears it", async ({ page }) => {
  // A radio group cannot be un-chosen; these are toggle buttons precisely so
  // "both" stays reachable by clicking, not only by editing the URL.
  await page.goto("/buy/search?segment=residential");
  await expect(
    page.getByRole("button", { name: "Residential", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Residential", exact: true }).click();
  await expect(page).not.toHaveURL(/segment=/);
});

test("switching segment does not strand the visitor on a stale page", async ({
  page,
}) => {
  // Narrowing the results invalidates the offset: filtering to Commercial from
  // page 3 of the residential stock would land on an empty page that reads as
  // an empty catalogue.
  await page.goto("/buy/search?page=2");
  await page.getByRole("button", { name: "Commercial", exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]page=/);
});

test("/commercial/search is retired onto the segment filter", async ({
  page,
}) => {
  const response = await page.goto("/commercial/search?beds=2");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/buy\/search\?/);
  // The filter that was on the old URL survives the move.
  await expect(page).toHaveURL(/beds=2/);
  await expect(page).toHaveURL(/segment=commercial/);
  await expect(
    page.getByRole("button", { name: "Commercial", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the four mode pills are gone", async ({ page }) => {
  // The regression this guards: re-adding the strip would put the transaction
  // axis in two places again, and put Commercial back on the wrong one.
  await page.goto("/buy/search");
  for (const name of ["Buy", "Rent", "Off-plan"]) {
    await expect(
      page.getByRole("radio", { name, exact: true }),
    ).toHaveCount(0);
  }
});
