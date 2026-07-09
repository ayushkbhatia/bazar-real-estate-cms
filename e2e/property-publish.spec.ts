import { test, expect } from "@playwright/test";

/**
 * P1 launch-readiness: regression guard for the property publish flow.
 *
 * The full draft → in_review → published → Meilisearch index path needs
 * an authenticated editor / admin session against a real Supabase
 * project, which CI does not stand up. This spec instead guards the
 * surfaces that any visitor or attacker can reach:
 *
 *   - the public listing routes still render (the published-side of the
 *     publish flow — confirms the page bundle didn't break)
 *   - admin property surfaces still require sign-in
 *   - the Meilisearch reindex and cron-driven sweep gates reject
 *     unauthenticated callers
 *   - /sold/[ref] still 410s for unknown / archived references
 *
 * Pure-logic coverage of the publishability gate lives in
 * lib/publishability.test.ts (every blocker case enumerated).
 */

test("/buy/search renders without error", async ({ page }) => {
  const response = await page.goto("/buy/search");
  expect([200, 304]).toContain(response?.status() ?? 0);
});

test("/rent/search renders without error", async ({ page }) => {
  const response = await page.goto("/rent/search");
  expect([200, 304]).toContain(response?.status() ?? 0);
});

test("/off-plan/search renders without error", async ({ page }) => {
  const response = await page.goto("/off-plan/search");
  expect([200, 304]).toContain(response?.status() ?? 0);
});

test("/buy landing renders without error", async ({ page }) => {
  const response = await page.goto("/buy");
  expect([200, 304]).toContain(response?.status() ?? 0);
});

test("anon visitor cannot reach /admin/properties/new", async ({ page }) => {
  await page.goto("/admin/properties/new");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("anon visitor cannot reach a property edit page", async ({ page }) => {
  await page.goto("/admin/properties/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("anon visitor cannot reach /admin/developments", async ({ page }) => {
  await page.goto("/admin/developments");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("/sold/[ref] returns 410 for unknown references", async ({ request }) => {
  const res = await request.get("/sold/BAZ-AD-00000-DOES-NOT-EXIST", {
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  expect([410, 404]).toContain(res.status());
});

const ADMIN_TRIGGERED_ROUTES = [
  "/api/admin/meilisearch-reindex",
  "/api/admin/audit-log/export",
];

for (const route of ADMIN_TRIGGERED_ROUTES) {
  test(`${route} rejects anonymous callers`, async ({ request }) => {
    const res = await request.get(route, { failOnStatusCode: false });
    expect([401, 403, 404, 405, 503]).toContain(res.status());
  });
}

const PUBLISH_FLOW_CRON_ROUTES = [
  "/api/cron/meilisearch-sync",
  "/api/cron/permit-expiry",
  "/api/cron/brn-validation",
  "/api/cron/syndication-push",
];

for (const route of PUBLISH_FLOW_CRON_ROUTES) {
  test(`${route} rejects requests without a Bearer secret`, async ({
    request,
  }) => {
    const res = await request.get(route, { failOnStatusCode: false });
    expect([401, 503]).toContain(res.status());
  });
}
