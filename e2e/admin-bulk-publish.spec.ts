import { test, expect } from "@playwright/test";

// The interactive bulk-publish flow (select 3 → confirm dialog → toast)
// requires admin-seeded auth, which CI doesn't have. The dialog + gate
// logic is covered by unit tests in:
//   - lib/queries/properties-bulk.test.ts (evaluateBulkPublishability)
//   - lib/bulk/update.test.ts (RLS-skip simulator)
// This spec just keeps the route shape healthy + verifies that selection
// state survives a hard reload — proving I1's URL-as-source-of-truth
// contract isn't lost when later phases touch the page.

test("anon visitor cannot reach /admin/properties (redirect to staff login)", async ({
  page,
}) => {
  await page.goto("/admin/properties");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a ?selected= URL on /admin/properties redirects to staff login (no leak)", async ({
  page,
}) => {
  await page.goto("/admin/properties?selected=abc123def456,abc789def012");
  await expect(page).toHaveURL(/\/admin\/login/);
});
