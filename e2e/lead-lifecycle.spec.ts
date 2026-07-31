import { test, expect } from "@playwright/test";

/**
 * P1 launch-readiness: regression guard for the lead-lifecycle plumbing.
 *
 * Full enquiry → auto-reply → escalation → deal coverage would need an
 * authenticated admin session against a real Supabase project, which CI
 * does not stand up. This spec instead guards the surfaces that anyone
 * (any visitor, any attacker, the cron runner) can reach:
 *
 *   - the public /contact form renders + has an enquiry shape we expect
 *   - the cron Bearer auth gate rejects unauthenticated callers across
 *     every minute-cadence + escalation route (catching the "silent
 *     503s leak the funnel" failure mode the P0 work addressed)
 *   - admin enquiry surfaces still require sign-in
 *
 * Pure-logic coverage of the schemas, escalation eligibility, and deal
 * stage machine lives in:
 *   - lib/schemas/enquiry.test.ts
 *   - lib/saved-search-alerts.test.ts (cron sweep math)
 *   - lib/deals.test.ts (stage machine + KYC docs gating)
 */

test("/contact renders the public enquiry form", async ({ page }) => {
  await page.goto("/contact");
  // The form must exist and expose the name + message inputs the
  // createEnquiry server action validates against (see
  // lib/schemas/enquiry.ts).
  const nameInput = page.locator(
    'input[name="name"], input[id="name"]',
  );
  const messageInput = page.locator(
    'textarea[name="message"], textarea[id="message"]',
  );
  await expect(nameInput.first()).toBeVisible();
  await expect(messageInput.first()).toBeVisible();
});

test("anon visitor cannot reach /admin/enquiries", async ({ page }) => {
  await page.goto("/admin/enquiries");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("anon visitor cannot reach /admin/deals", async ({ page }) => {
  await page.goto("/admin/deals");
  await expect(page).toHaveURL(/\/admin\/login/);
});

const CRON_ROUTES = [
  "/api/cron/enquiry-auto-reply",
  "/api/cron/enquiry-escalation",
  "/api/cron/viewing-reminders",
  // saved-search-alerts and saved-search-alerts-diff were removed in #219
  // along with four other unused jobs; what they maintained is derived now.
  // Keep this list in step with app/api/cron/ and vercel.json — a route here
  // that no longer exists returns 404, which is not the fail-closed behaviour
  // these tests are meant to prove.
];

for (const route of CRON_ROUTES) {
  test(`${route} rejects requests without a Bearer secret`, async ({
    request,
  }) => {
    const res = await request.get(route, { failOnStatusCode: false });
    // Without CRON_SECRET set → 503 fail-closed.
    // With CRON_SECRET set but missing/wrong Authorization → 401.
    // Either is correct; both prove the route does not run when called
    // by an anonymous attacker.
    expect([401, 503]).toContain(res.status());
  });

  test(`${route} rejects requests with the wrong Bearer secret`, async ({
    request,
  }) => {
    const res = await request.get(route, {
      headers: { authorization: "Bearer not-the-real-secret" },
      failOnStatusCode: false,
    });
    expect([401, 503]).toContain(res.status());
  });
}
