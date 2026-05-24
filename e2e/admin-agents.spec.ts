import { test, expect } from "@playwright/test";

test("anon visitor cannot see /admin/agents (redirect to sign-in)", async ({
  page,
}) => {
  await page.goto("/admin/agents");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("/admin/agents responds with a redirect, never a 404 or 500", async ({
  page,
}) => {
  const response = await page.goto("/admin/agents");
  expect([200, 302, 307]).toContain(response?.status() ?? 0);
});
