import { test, expect } from "@playwright/test";

// Realtime two-context sync requires admin auth seeding (not available
// in CI). Hook + LiveDot are unit-covered; this spec just keeps the
// route shape healthy.

test("anon visitor cannot reach /admin/properties (redirect to staff login)", async ({
  page,
}) => {
  await page.goto("/admin/properties");
  await expect(page).toHaveURL(/\/admin\/login/);
});
