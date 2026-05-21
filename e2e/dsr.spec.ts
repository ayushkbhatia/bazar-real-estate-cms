import { test, expect } from "@playwright/test";

test("/account/data-export gates anon users to sign-in", async ({ page }) => {
  await page.goto("/account/data-export");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("/account/data-deletion gates anon users to sign-in", async ({ page }) => {
  await page.goto("/account/data-deletion");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("/data-deleted renders the deletion success page", async ({ page }) => {
  await page.goto("/data-deleted");
  await expect(
    page.getByRole("heading", { name: /your account has been deleted/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /back to the marketplace/i }),
  ).toBeVisible();
});

test("/data-deleted?reason=expired surfaces the failure copy", async ({
  page,
}) => {
  await page.goto("/data-deleted?reason=expired");
  await expect(
    page.getByRole("heading", { name: /couldn'?t complete the deletion/i }),
  ).toBeVisible();
  await expect(page.getByText(/expired/i)).toBeVisible();
});

test("legal/privacy still links to the DSR endpoints", async ({ page }) => {
  await page.goto("/legal/privacy");
  await expect(
    page.getByRole("link", { name: "/account/data-export" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "/account/data-deletion" }),
  ).toBeVisible();
});

// NB: We don't directly exercise the /account/*/confirm/[token] route
// handlers from E2E because they sit behind the same /account auth gate.
// Their happy-path is covered indirectly by the success/failure flows on
// /data-deleted, and the token-validation logic has unit coverage in
// lib/dsr.test.ts.
