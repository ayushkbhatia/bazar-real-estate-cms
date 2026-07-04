import { test, expect } from "@playwright/test";

test("anon visitor cannot reach /admin/settings", async ({ page }) => {
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/admin\/login/);
});
