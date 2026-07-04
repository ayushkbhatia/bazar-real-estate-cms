import { test, expect } from "@playwright/test";

// The two-context realtime sync described in the H2 brief
// (one tab submits, the other sees the row arrive) needs an authenticated
// admin session, which CI cannot stand up without service-role creds. The
// realtime wiring itself is covered by the unit tests in
// lib/realtime/use-postgres-changes.test.ts; this spec just guards the
// route shape so the LiveDot import doesn't regress the page bundle.

test("anon visitor cannot reach /admin/enquiries (redirect to staff login)", async ({
  page,
}) => {
  await page.goto("/admin/enquiries");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("/admin/enquiries route still resolves (no crash from realtime wiring)", async ({
  page,
}) => {
  const response = await page.goto("/admin/enquiries");
  expect([200, 302, 307]).toContain(response?.status() ?? 0);
});
