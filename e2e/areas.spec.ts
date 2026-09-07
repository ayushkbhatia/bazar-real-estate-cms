import { test, expect } from "@playwright/test";
import { firstAreaPath } from "./_helpers";

// Headline copy on the master pages is CMS-owned since #222 — asserting the
// literal turns a routine copy edit into a red build. Assert that an h1
// renders; the page <title> stays hardcoded, so that assertion is still safe.

test("public /areas renders the neighbourhood index", async ({ page }) => {
  await page.goto("/areas");
  await expect(
    page.getByRole("heading", { level: 1 }).first(),
  ).toBeVisible();
  // At least one area card should link into /areas/<slug>
  await expect(page.locator("a[href^='/areas/']").first()).toBeVisible();
});

test("an area guide renders its bands", async ({ page }) => {
  // This used to name Saadiyat Island. Areas are editor-owned — one can be
  // renamed, re-slugged or removed from the CMS — so the spec takes whichever
  // guide the index currently links to and asserts the template around it.
  const path = await firstAreaPath(page);
  test.skip(!path, "No areas published.");
  await page.goto(path!);

  // Pin to the h1; the page also has h2s like "Properties for sale in
  // <area>" that would otherwise trip Playwright's strict-mode multi-match
  // check.
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeEmpty();

  // These run against the live CMS, so the assertions have to survive an
  // editor's copy change and the market-statistics band being either the
  // editorial figures typed into the CMS or the medians on the guide record.
  await expect(
    page.getByText(/median apt \/ ft²|sale price index/i).first(),
  ).toBeVisible();
  /*
   * The for-sale band, by test id.
   *
   * Its heading was matched as /properties for sale/i, which is
   * `sv("listings", "heading")` — a PER-AREA CMS field whose code fallback is
   * the only reason the match held. An editor giving one guide a heading of
   * its own reddens main, and the same override on the rentals band is
   * already normal practice. The band and the rail inside it are the invariant;
   * the words above them are not.
   */
  const forSale = page.getByTestId("area-band-listings");
  await expect(forSale).toBeVisible();
  await expect(forSale.getByRole("heading", { level: 2 })).not.toBeEmpty();
  // Deliberately nothing on the map band. Its heading is CMS-owned — this area
  // currently overrides it to "Location" — and the band hides itself for an
  // area with no coordinates, so any assertion on it is a copy edit away from
  // reddening main.
});

test("every area in the catalogue stays reachable, not only the curated grid", async ({
  page,
  request,
}) => {
  /*
   * This used to count links on /areas and require more than fifteen, because
   * the A–Z directory band below the grid listed the whole catalogue.
   *
   * #502 removed that band deliberately. The guarantee it was standing in for
   * — an area added in the CMS is reachable, not stranded behind a curated
   * eight — did not go with it: `app/sitemap.ts` advertises every row of
   * `kind = "area"`, which is the surface that actually decides whether a new
   * guide gets crawled. So the assertion moves there rather than being
   * loosened to fit the smaller grid, which would have deleted the guarantee
   * instead of relocating it.
   *
   * The grid keeps a floor of its own. It is CMS-curated, so the exact cards
   * are an editor's business, but a page that links into no guide at all is
   * broken however few areas are featured.
   */
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const advertised = new Set(
    [...(await sitemap.text()).matchAll(/<loc>[^<]*\/areas\/([^<]+)<\/loc>/g)].map(
      (m) => m[1]!,
    ),
  );
  expect(advertised.size).toBeGreaterThan(15);

  await page.goto("/areas");
  const grid = await page.locator("a[href^='/areas/']").count();
  expect(grid).toBeGreaterThan(3);
});

test("/areas/<unknown> 404s", async ({ page }) => {
  const response = await page.goto("/areas/this-area-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("/communities legacy URLs permanently redirect to /areas", async ({
  page,
}) => {
  await page.goto("/communities");
  expect(new URL(page.url()).pathname).toBe("/areas");

  await page.goto("/communities/saadiyat-island");
  expect(new URL(page.url()).pathname).toBe("/areas/saadiyat-island");
});
