import { test, expect } from "@playwright/test";

// As with H2, the realtime two-context sync requires an authenticated
// admin session that CI cannot stand up. This spec keeps the route
// from regressing while the wiring itself is unit-covered.

test("anon visitor cannot reach an enquiry detail page", async ({ page }) => {
  // Any UUID-shaped path is fine; auth blocks before the row lookup runs.
  await page.goto("/admin/enquiries/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/admin\/login/);
});
