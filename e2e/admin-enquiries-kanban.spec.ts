import { test, expect } from "@playwright/test";

test("anon visitor cannot reach the Kanban view", async ({ page }) => {
  await page.goto("/admin/enquiries?view=kanban");
  await expect(page).toHaveURL(/\/sign-in/);
});
