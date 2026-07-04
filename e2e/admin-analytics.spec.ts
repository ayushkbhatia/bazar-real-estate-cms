import { test, expect } from "@playwright/test";

test("anon visitor cannot reach /admin/analytics", async ({ page }) => {
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/admin\/login/);
});
