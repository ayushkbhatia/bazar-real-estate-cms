import { test, expect } from "@playwright/test";

/**
 * Sprint 1 · T2 — defence-in-depth gate on /admin/*.
 *
 * The layout in app/(admin)/layout.tsx calls requireRole(STAFF_ROLES).
 * For anonymous users, proxy.ts redirects to /sign-in upstream. For
 * signed-in non-staff users, requireRole throws notFound() so the
 * response is a 404 — not a 500 and not a redirect loop. We can't
 * seed a non-staff session in CI without service-role creds, so this
 * spec verifies the anonymous + 404 paths and documents the non-staff
 * scenario for manual QA.
 */

test("anonymous visitor on /admin is redirected to /sign-in (not 500)", async ({
  page,
}) => {
  const response = await page.goto("/admin");
  // Either a 200 from the sign-in page (after redirect) or a 30x.
  expect([200, 302, 303, 307, 308]).toContain(response?.status() ?? 0);
  await expect(page).toHaveURL(/\/sign-in/);
});

test("a deep /admin route also redirects (no admin-route leak)", async ({
  page,
}) => {
  const response = await page.goto("/admin/properties");
  expect([200, 302, 303, 307, 308]).toContain(response?.status() ?? 0);
  await expect(page).toHaveURL(/\/sign-in/);
});

test("404 route shows the branded not-found page (Sprint 1 · T1)", async ({
  page,
}) => {
  const response = await page.goto("/this-route-does-not-exist-xyz");
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/this page isn.?t here/i)).toBeVisible();
});
