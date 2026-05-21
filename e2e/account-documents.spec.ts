import { test, expect } from "@playwright/test";

test("anon visitor is redirected to /sign-in from the document vault", async ({
  page,
}) => {
  await page.goto("/account/documents");
  await expect(page).toHaveURL(/\/sign-in/);
});
