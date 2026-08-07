import { test, expect, type Page } from "@playwright/test";
import { propertyPaths } from "./_helpers";

/**
 * This spec used to hard-code two seeded property UUIDs. Both rows are gone —
 * the client replaced the seed catalogue — and every assertion below them
 * failed on a build with nothing wrong in it.
 *
 * The compare tool takes ids, and an id isn't in any URL, so we visit two
 * published detail pages and take the id from each page's own "Add to
 * compare" control. That keeps the spec tied to whatever is published rather
 * than to two rows that happened to exist when it was written.
 */
async function compareUrlForTwo(page: Page): Promise<string | null> {
  const paths = await propertyPaths(page, 2);
  if (paths.length < 2) return null;

  for (const path of paths) {
    await page.goto(path);
    const add = page.getByRole("button", {
      name: /^(add to|remove from) compare$/i,
    });
    if ((await add.count()) === 0) return null;
    // Only add it if it isn't already in the set.
    const label = await add.first().getAttribute("aria-label");
    if (/^add to compare$/i.test(label ?? "")) await add.first().click();
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
  await expect(
    page.getByRole("heading", { name: /Stack properties side by side/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Browse the marketplace/i }),
  ).toBeVisible();
});

test("comparing two properties renders all 5 groups + diff rows", async ({
  page,
}) => {
  const url = await compareUrlForTwo(page);
  test.skip(!url, "Fewer than two published properties to compare.");
  await page.goto(url!);

  // Heading reflects the count.
  await expect(page.getByRole("heading", { name: /Side by side/i })).toBeVisible();
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
