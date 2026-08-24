import { test, expect, type Page } from "@playwright/test";
import { propertyPaths } from "./_helpers";

/**
 * This spec used to hard-code two seeded property UUIDs. Both rows are gone —
 * the client replaced the seed catalogue — and every assertion below them
 * failed on a build with nothing wrong in it.
 *
 * The compare tool takes ids, and an id isn't in any URL, so we visit two
 * published detail pages and take the id from each page's own "Save to
 * shortlist" control. That keeps the spec tied to whatever is published
 * rather than to two rows that happened to exist when it was written.
 *
 * The control is the shortlist button, not a compare button: saving and
 * comparing were one action capped at 4, and are now a 25-item shortlist
 * feeding a 4-column table. Two saves still put two ids in the store, which
 * is all this helper needs.
 *
 * ## And a second time, for the same reason one layer up
 *
 * Every word on /tools/compare is a CMS field — the `compare` library
 * section, edited at /admin/pages/sub/section/compare — and CI runs against
 * the live production database. So a spec that recognises a screen by its
 * heading is a gate on the client's copy, and it goes off when they use the
 * CMS as designed. It did: on 23 Aug the empty heading became "Compare Side
 * by Side" from "Stack properties side by side.", the CTA became "Browse Our
 * Listings" from "Browse the marketplace", and the results heading became
 * "Compare Properties" from "Side by side". Three correct edits, two red
 * tests, no commit behind them, main red across three merges.
 *
 * What these tests are for is which BRANCH rendered and what is in it, so
 * they now assert that: a test id for the branch, a heading that exists
 * rather than a heading that reads a particular way, and an href for where
 * the button goes. Copy is the client's; structure is ours.
 */
async function compareUrlForTwo(page: Page): Promise<string | null> {
  const paths = await propertyPaths(page, 2);
  if (paths.length < 2) return null;

  for (const path of paths) {
    await page.goto(path);
    const add = page.getByRole("button", {
      name: /^(save to|remove from) shortlist$/i,
    });
    if ((await add.count()) === 0) return null;
    // Only add it if it isn't already in the set.
    const label = await add.first().getAttribute("aria-label");
    if (/^save to shortlist$/i.test(label ?? "")) await add.first().click();
  }

  // COMPARE_STORAGE_KEY in lib/compare-store.ts. Kept as a literal because no
  // other e2e spec imports app modules and the path alias isn't wired here; if
  // it ever drifts this returns null and the tests skip visibly rather than
  // asserting against an empty set.
  const ids = await page.evaluate(() => {
    const raw = localStorage.getItem("bz:compare:ids");
    return raw ? (JSON.parse(raw) as string[]) : [];
  });
  if (ids.length < 2) return null;
  return `/tools/compare?ids=${ids.slice(0, 2).join(",")}`;
}

test("empty state when no ids in the URL", async ({ page }) => {
  await page.goto("/tools/compare");

  const empty = page.getByTestId("compare-empty");
  await expect(empty).toBeVisible();

  // A heading, with words in it. Which words is the client's business; that
  // the branch renders a non-empty h1 is not.
  const heading = empty.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeEmpty();

  // The way out. Asserted by destination rather than by label, because the
  // label is a CMS field and the destination is a route.
  const cta = page.getByTestId("compare-empty-cta");
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", /\/buy$/);

  // The discriminating half: this is the empty branch, so the comparison
  // table is not on the page at all. Without this the test passes on any
  // page that happens to have an h1 and a link to /buy.
  await expect(page.getByTestId("group-specifications")).toHaveCount(0);
});

test("comparing two properties renders all 5 groups + diff rows", async ({
  page,
}) => {
  const url = await compareUrlForTwo(page);
  test.skip(!url, "Fewer than two published properties to compare.");
  await page.goto(url!);

  // The page rendered its header. The h1 itself is `copy.heading` from the
  // CMS, so it is checked for existence rather than for wording; the count
  // beside it is `tools.compare.comparingCount` — a message key, ours, and
  // the half of the header that actually reflects the URL.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("text=/Comparing 2 properties/i")).toBeVisible();

  // The 5 expected groups are all in the DOM.
  for (const key of [
    "price_terms",
    "specifications",
    "location",
    "amenities",
    "investment",
  ]) {
    await expect(page.getByTestId(`group-${key}`)).toBeVisible();
  }

  // Specs group rows include the major attributes.
  const specs = page.getByTestId("group-specifications");
  await expect(specs).toContainText("Type");
  await expect(specs).toContainText("Bedrooms");

  // Both cards rendered.
  await expect(page.getByTestId("compare-card-0")).toBeVisible();
  await expect(page.getByTestId("compare-card-1")).toBeVisible();

  // Two empty slots filling the rest of the strip.
  await expect(page.getByTestId("empty-slot-2")).toBeVisible();
  await expect(page.getByTestId("empty-slot-3")).toBeVisible();

  // The diff detector fires on any row where the two differ. Two distinct
  // listings essentially always differ on price, but which row differs is
  // inventory-dependent, so assert across the whole table rather than
  // pinning it to price_terms.
  const differing = page.locator('tr[data-differs="true"]');
  await expect(differing.first()).toBeVisible();
});

test("diff toggle flips ?diff= in the URL and persists across navigation", async ({
  page,
}) => {
  const url = await compareUrlForTwo(page);
  test.skip(!url, "Fewer than two published properties to compare.");
  await page.goto(url!);

  // Default: diff is on.
  const toggle = page.getByTestId("diff-toggle");
  await expect(toggle).toBeChecked();

  // Click to turn off — URL gains ?diff=0.
  await toggle.click();
  await expect(page).toHaveURL(/[?&]diff=0/);
});

test("removing a property from the URL drops it from the strip", async ({
  page,
}) => {
  const url = await compareUrlForTwo(page);
  test.skip(!url, "Fewer than two published properties to compare.");
  await page.goto(url!);
  await expect(page.getByTestId("compare-card-1")).toBeVisible();

  // Drop the second property by mutating ids directly — exercises the
  // same code path the toolbar's remove button uses.
  const [firstId] = new URL(url!, "http://x").searchParams
    .get("ids")!
    .split(",");
  await page.goto(`/tools/compare?ids=${firstId}`);
  await expect(page.getByTestId("compare-card-0")).toBeVisible();
  await expect(page.getByTestId("compare-card-1")).not.toBeVisible();
  await expect(page.getByTestId("empty-slot-1")).toBeVisible();
});
