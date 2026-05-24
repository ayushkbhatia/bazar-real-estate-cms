import { test, expect } from "@playwright/test";

test("anon visitor is redirected to /sign-in from /account/profile", async ({
  page,
}) => {
  await page.goto("/account/profile");
  await expect(page).toHaveURL(/\/sign-in/);
});
