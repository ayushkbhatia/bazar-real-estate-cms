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
  const response = await page.goto("/developers/aldar");
  test.skip(response?.status() === 404, "Aldar is unpublished in the CMS.");
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
  const response = await page.goto("/developers/aldar");
  test.skip(response?.status() === 404, "Aldar is unpublished in the CMS.");

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

// These specs run against the live CMS database, so anything that names one
// developer is a spec an editor can redden by unpublishing it — which is
// exactly what happened once the unpublish control shipped. They assert the
// invariant instead, and skip rather than fail when the row they need is
// currently draft.

test("every developer the grid links to actually resolves", async ({ page }) => {
  await page.goto("/developers");
  const hrefs = [
    ...new Set(
      await page.locator("a[href^='/developers/']").evaluateAll((els) =>
        els.map((e) => e.getAttribute("href")!).filter(Boolean),
      ),
    ),
  ];
  expect(hrefs.length).toBeGreaterThan(0);

  // A draft developer must leave the grid at the same moment its page starts
  // 404-ing. A card pointing at a dead page is the failure this guards.
  const dead: string[] = [];
  for (const href of hrefs) {
    const res = await page.request.get(href);
    if (res.status() >= 400) dead.push(`${href} → ${res.status()}`);
  }
  expect(dead, `Grid links to pages that do not resolve:\n  ${dead.join("\n  ")}`)
    .toEqual([]);
});

test("a card with no shipped art still renders as a card", async ({ page }) => {
  await page.goto("/developers");

  // This used to name `national-holding` — a row staff added, with no logo in
  // /public/developers, which is exactly the case the catalogue merge exists
  // for. Then an editor unpublished it and every open PR went red with no
  // commit behind it: CI runs against the live production project, so which
  // developers are published is editorial state, not test state.
  //
  // So assert the behaviour instead of the row. Whether any given developer is
  // on the page is the client's call; that every card renders its name and
  // either real art or its initials — rather than collapsing to an empty box
  // or a broken image — is ours, and holds however many are published. The
  // merge's precedence rules are unit-tested in _directory.test.ts, where a
  // fixed set of rows is the right thing to have.
  const cards = page.locator("a[href^='/developers/']");
  await expect(cards.first()).toBeVisible();

  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    // Every card names its developer, art or no art.
    await expect(card).not.toBeEmpty();

    const images = card.locator("img");
    if ((await images.count()) === 0) {
      // The initials stand in for the logo and hold the row's height, so the
      // grid doesn't collapse around a logo-less entry.
      await expect(card.locator("span[aria-hidden='true']")).toHaveCount(1);
    } else {
      // A card that does carry art must carry a real source — an empty `src`
      // is what a half-merged entry used to render.
      await expect(images.first()).toHaveAttribute("src", /\S/);
    }
  }});

test("a developer carried by both sources is listed once", async ({ page }) => {
  await page.goto("/developers");
  // The shipped directory calls it `modon`, the catalogue row `modon-properties`.
  // Merging on the normalised name is what stops two MODON cards rendering.
  const merged = page.locator("a[href='/developers/modon-properties']");
  test.skip(
    (await merged.count()) === 0,
    "MODON is unpublished in the CMS — nothing to assert about its card.",
  );
  await expect(merged).toHaveCount(1);
  await expect(page.locator("a[href='/developers/modon']")).toHaveCount(0);
});

test("the superseded developer slug still renders, canonical to the row", async ({
  page,
}) => {
  const response = await page.goto("/developers/modon");
  test.skip(
    response?.status() === 404,
    "MODON is unpublished in the CMS — its superseded slug 404s by design.",
  );
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
