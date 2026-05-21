import { test, expect } from "@playwright/test";

test("/account/data-export gates anon users to sign-in", async ({ page }) => {
  await page.goto("/account/data-export");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("/account/data-deletion gates anon users to sign-in", async ({ page }) => {
  await page.goto("/account/data-deletion");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("/account-deleted renders the deletion success page", async ({ page }) => {
  await page.goto("/account-deleted");
  await expect(
    page.getByRole("heading", { name: /your account has been deleted/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /back to the marketplace/i }),
  ).toBeVisible();
});

test("/account-deleted?reason=expired surfaces the failure copy", async ({
  page,
}) => {
  await page.goto("/account-deleted?reason=expired");
  await expect(
    page.getByRole("heading", { name: /couldn'?t complete the deletion/i }),
  ).toBeVisible();
  await expect(page.getByText(/expired/i)).toBeVisible();
});

test("data-export confirm route returns 404 for a malformed token", async ({
  request,
}) => {
  const response = await request.get(
    "/account/data-export/confirm/not-a-token",
    {
      maxRedirects: 0,
    },
  );
  expect([404, 410]).toContain(response.status());
});

test("data-deletion confirm route redirects bad tokens to /account-deleted with a reason", async ({
  page,
}) => {
  await page.goto(
    "/account/data-deletion/confirm/00000000000000000000000000000000000000000000000000000000abcdef00",
  );
  await expect(page).toHaveURL(/\/account-deleted\?reason=/);
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
