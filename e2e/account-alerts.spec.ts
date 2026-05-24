import { test, expect } from "@playwright/test";

test("anon visitor is redirected to /sign-in from /account/alerts", async ({
  page,
}) => {
  await page.goto("/account/alerts");
  await expect(page).toHaveURL(/\/sign-in/);
});
