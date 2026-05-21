import { test, expect } from "@playwright/test";

test("anon visitor cannot reach /admin/deals", async ({ page }) => {
  await page.goto("/admin/deals");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("anon visitor cannot reach a deal detail page", async ({ page }) => {
  await page.goto("/admin/deals/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("documents download endpoint rejects anonymous requests", async ({
  request,
}) => {
  const res = await request.get(
    "/api/documents/00000000-0000-0000-0000-000000000000/download",
    { maxRedirects: 0, failOnStatusCode: false },
  );
  expect([401, 404, 503]).toContain(res.status());
});
