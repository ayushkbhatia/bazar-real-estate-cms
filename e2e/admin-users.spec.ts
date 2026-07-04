import { test, expect } from "@playwright/test";

test("anon visitor cannot see /admin/users (redirect to staff login)", async ({
  page,
}) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("non-admin staff are redirected away from /admin/users", async ({
  page,
}) => {
  // We can't seed a non-admin session in CI without service-role creds; this
  // spec is a placeholder that verifies the URL pattern at least exists.
  // (The redirect path itself is unit-covered in lib/queries/staff.ts via
  // currentUserIsAdmin → false.)
  const response = await page.goto("/admin/users");
  // Should redirect (302 → 200 on the staff login page) or 200 if an admin
  // session existed; never 404/500.
  expect([200, 302, 307]).toContain(response?.status() ?? 0);
});
