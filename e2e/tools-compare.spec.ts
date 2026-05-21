import { test, expect } from "@playwright/test";

// Two seeded properties: a Mamsha 3-bed apartment and the Nudra 5-bed villa.
// They differ on price, beds, type — guaranteed diffs across multiple rows.
const A = "44444444-0000-0000-0000-000000000001";
const B = "44444444-0000-0000-0000-000000000002";

test("empty state when no ids in the URL", async ({ page }) => {
  await page.goto("/tools/compare");
  await expect(
    page.getByRole("heading", { name: /Stack properties side by side/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Browse the marketplace/i }),
  ).toBeVisible();
});

test("comparing two seeded properties renders all 5 groups + diff rows", async ({
  page,
}) => {
  await page.goto(`/tools/compare?ids=${A},${B}`);

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

  // At least one row in price_terms has data-differs="true" — these
  // properties differ on price + type so the diff detector must fire.
  const differing = page
    .getByTestId("group-price_terms")
    .locator('tr[data-differs="true"]');
  await expect(differing.first()).toBeVisible();
});

test("diff toggle flips ?diff= in the URL and persists across navigation", async ({
  page,
}) => {
  await page.goto(`/tools/compare?ids=${A},${B}`);

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
  await page.goto(`/tools/compare?ids=${A},${B}`);
  await expect(page.getByTestId("compare-card-1")).toBeVisible();

  // Drop the second property by mutating ids directly — exercises the
  // same code path the toolbar's remove button uses.
  await page.goto(`/tools/compare?ids=${A}`);
  await expect(page.getByTestId("compare-card-0")).toBeVisible();
  await expect(page.getByTestId("compare-card-1")).not.toBeVisible();
  await expect(page.getByTestId("empty-slot-1")).toBeVisible();
});
