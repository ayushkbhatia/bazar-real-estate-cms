import { expect, test, type Page } from "@playwright/test";

/**
 * Fixes from the mortgage module's security review
 * (docs/mortgage/SECURITY-REVIEW.md), where they show from outside:
 * SR-15's framing headers, SR-16's JSON-only routes, and SR-13's partner
 * banks page for an admin without a mortgage role.
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

test("SR-13: an admin without a mortgage role keeps the partner banks from settings", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/settings");
  await page.getByRole("link", { name: "Partner banks" }).click();
  await expect(page).toHaveURL(/\/admin\/settings\/partner-banks$/);
  await expect(page.getByRole("heading", { name: "Partner banks", level: 1 })).toBeVisible();
  // The seeded banks, each with the edit control only an editor gets.
  for (const code of ["FAB", "ADCB", "Mashreq"]) {
    await expect(page.getByRole("row").filter({ hasText: code }).first()).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /^Edit / }).first()).toBeVisible();
  await page.getByRole("button", { name: "Add bank" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
