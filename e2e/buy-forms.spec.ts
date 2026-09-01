import { test, expect } from "@playwright/test";

/**
 * Regression guard for the shared-destination bug: for 27 migrations the
 * "Ready" and "Resale" entry points both pointed at /buy, so nobody could see
 * that the two completion forms had no separate destination. These assertions
 * fail the moment either route disappears, starts 404ing, or the two pages
 * collapse back onto one heading.
 *
 * Completion form is a second axis on top of transaction mode: both routes are
 * still mode=buy. ready_new = the developer's first sale (provenance, not
 * age); resale = previously owned.
 */

const ROUTES = [
  { path: "/buy/ready", label: "ready" },
  { path: "/buy/resale", label: "resale" },
] as const;

test("each buy completion-form route resolves 200 at its own URL", async ({
  page,
}) => {
  for (const { path } of ROUTES) {
    const response = await page.goto(path);
    expect(response, `no response for ${path}`).not.toBeNull();
    expect(response!.status(), `${path} should return 200`).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("h1")).toHaveCount(1);
  }
});

test("ready and resale render different h1s at distinct URLs", async ({
  page,
}) => {
  await page.goto("/buy/ready");
  const readyUrl = page.url();
  const readyH1 = (await page.locator("h1").innerText()).trim();

  await page.goto("/buy/resale");
  const resaleUrl = page.url();
  const resaleH1 = (await page.locator("h1").innerText()).trim();

  expect(readyH1.length).toBeGreaterThan(0);
  expect(resaleH1.length).toBeGreaterThan(0);
  // The actual bug: one shared heading across two supposedly distinct pages.
  expect(readyH1).not.toBe(resaleH1);
  expect(readyUrl).not.toBe(resaleUrl);

  // …and neither may silently reuse the generic all-sale heading.
  await page.goto("/buy/search");
  const searchH1 = (await page.locator("h1").innerText()).trim();
  expect(readyH1).not.toBe(searchH1);
  expect(resaleH1).not.toBe(searchH1);
});

test("the completion-form routes carry the segment toggle, unset", async ({
  page,
}) => {
  // This used to assert the Buy pill of a four-mode strip. That strip is gone:
  // the transaction is already fixed by the route the visitor arrived on, so
  // the control above the results now filters the axis the route does NOT fix
  // — residential or commercial. Neither is pressed until someone presses one,
  // because "no filter" has to mean both.
  for (const { path } of ROUTES) {
    await page.goto(path);
    for (const name of ["Residential", "Commercial"]) {
      await expect(
        page.getByRole("button", { name, exact: true }),
        `${name} toggle missing on ${path}`,
      ).toHaveAttribute("aria-pressed", "false");
    }
  }
});

test("the form routes only list stock of their own form", async ({ page }) => {
  const seen = new Map<string, string[]>();
  for (const { path, label } of ROUTES) {
    await page.goto(path);
    seen.set(
      label,
      await page.locator("a[href^='/p/']").evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""),
      ),
    );
  }
  const ready = seen.get("ready") ?? [];
  const resale = seen.get("resale") ?? [];
  test.skip(
    ready.length === 0 || resale.length === 0,
    "no seeded listings on one of the form routes",
  );
  // A listing is either a first sale or previously owned, never both.
  const overlap = ready.filter((href) => resale.includes(href));
  expect(overlap, `listings on both form routes: ${overlap.join(", ")}`).toEqual(
    [],
  );
});
