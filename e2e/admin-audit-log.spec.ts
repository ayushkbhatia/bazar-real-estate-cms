import { test, expect } from "@playwright/test";

test("anon visitor cannot reach /admin/audit-log", async ({ page }) => {
  await page.goto("/admin/audit-log");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("audit CSV export endpoint rejects anon visitors", async ({
  request,
}) => {
  const res = await request.get("/api/admin/audit-log/export", {
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  // The route handler returns 403 for non-admins (anon = no staff row).
  expect(res.status()).toBe(403);
});
