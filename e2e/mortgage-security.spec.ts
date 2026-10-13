import { expect, test, type Page } from "@playwright/test";

/**
 * Fixes from the mortgage module's security review
 * (docs/mortgage/SECURITY-REVIEW.md), where they show from outside:
 * SR-15's framing headers and SR-16's JSON-only routes. SR-13's partner
 * banks page went with the banks (0156): it is gone for everyone.
 *
 * Signs in with the local seed's accounts, so it runs only against a local or
 * staging stack seeded by `npm run db:local:reset` — never production. See
 * playwright.mortgage.config.ts.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
test.skip(
  !BASE,
  "Runs only against a local or staging stack (set MORTGAGE_E2E_BASE_URL); the main e2e job reads production.",
);

// The local seed's admin, who has no mortgage role (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const ADMIN = { email: "mariam.alhashimi@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };

test.beforeEach(async ({ context }) => {
  // A decided consent, so the cookie banner stays out of the way.
  await context.addCookies([
    {
      name: "bz_consent",
      value: encodeURIComponent(
        JSON.stringify({ essential: true, analytics: false, marketing: false, decided_at: new Date().toISOString(), version: 1 }),
      ),
      url: BASE!,
    },
  ]);
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(ADMIN.email);
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // The login page is itself under /admin: wait until we've left it.
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"));
}

test("SR-15: the CMS and the mortgage flow can't be framed by another site", async ({ request }) => {
  for (const path of ["/admin/login", "/mortgages/apply", "/mortgages/p/not-a-real-link", "/mortgages/r/not-a-real-link"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.headers()["content-security-policy"], path).toBe("frame-ancestors 'none'");
    expect(res.headers()["x-frame-options"], path).toBe("DENY");
  }
  // The public site is unchanged.
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.headers()["x-frame-options"]).toBeUndefined();
});

test("SR-16: the mortgage API reads JSON only", async ({ request }) => {
  const plain = await request.post("/api/mortgage/drafts", {
    headers: { "content-type": "text/plain" },
    data: JSON.stringify({}),
  });
  expect(plain.status()).toBe(415);
  expect(await plain.json()).toMatchObject({ code: "invalid" });
});

test("the partner banks pages are gone (0156)", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/settings");
  await expect(page.getByRole("link", { name: "Partner banks" })).toHaveCount(0);
  for (const path of ["/admin/settings/partner-banks", "/admin/mortgages/banks"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
});
