import { test, expect } from "@playwright/test";

/**
 * Smoke cover for the staff door itself.
 *
 * `e2e/admin-rbac.spec.ts` proves an anonymous visitor is *redirected* to
 * /admin/login. Nothing checked that the page they land on is usable — so the
 * form could lose a field, or its links could 404, with the whole suite green.
 *
 * That gap matters while the customer-account surface is being removed: the
 * staff form imports `signInAction` from app/(public)/(auth)/_actions, inside
 * the route group scheduled for deletion, and today the "Forgot?" link points
 * into the customer auth pages that are also going away. These assertions are
 * what turn either mistake into a red build.
 *
 * Deliberately does NOT sign in — there is no seeded staff credential in CI.
 * Authenticated coverage needs a storageState project, tracked in the removal
 * plan.
 */

test("the staff sign-in page renders a usable form", async ({ page }) => {
  const response = await page.goto("/admin/login");
  expect(response?.status()).toBe(200);

  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in/i }),
  ).toBeVisible();
});

test("the staff page is not indexable", async ({ page }) => {
  await page.goto("/admin/login");
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", /noindex/i);
});

test("every link on the staff sign-in page resolves", async ({
  page,
  request,
}) => {
  await page.goto("/admin/login");

  const hrefs = await page.locator("a[href^='/']").evaluateAll((nodes) =>
    Array.from(
      new Set(
        nodes
          .map((n) => (n as HTMLAnchorElement).getAttribute("href") ?? "")
          .filter((h) => h.startsWith("/")),
      ),
    ),
  );

  // The password-recovery route is the one that must not silently 404 — a
  // staff member locked out has no other way back in.
  expect(hrefs.length).toBeGreaterThan(0);

  for (const href of hrefs) {
    const res = await request.get(href, { maxRedirects: 5 });
    expect(res.status(), `${href} should resolve`).toBeLessThan(400);
  }
});

test("a signed-out visitor sent to a deep admin path keeps the destination", async ({
  page,
}) => {
  // The ?redirect round-trip is what returns a staff member to the page they
  // asked for after signing in. Losing it is a silent regression.
  await page.goto("/admin/enquiries");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page).toHaveURL(/redirect=%2Fadmin%2Fenquiries|redirect=\/admin\/enquiries/);
});
