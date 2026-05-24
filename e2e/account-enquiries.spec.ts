import { test, expect } from "@playwright/test";

test("anon visitor is redirected to /sign-in from /account/enquiries", async ({
  page,
}) => {
  await page.goto("/account/enquiries");
  await expect(page).toHaveURL(/\/sign-in/);
});
