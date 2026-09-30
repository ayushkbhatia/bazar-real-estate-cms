import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * The mortgage team's CMS, end to end (docs/mortgage PLAN Phase 4): C1's
 * return highlight and "Show only these", and a consultancy taken from New to
 * Completed on C6.
 *
 * Signs in with the local seed's accounts and books real consultations, so it
 * runs only against a local or staging stack seeded by `npm run
 * db:local:reset` — never production. See playwright.mortgage.config.ts.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
test.skip(
  !BASE,
  "Runs only against a local or staging stack (set MORTGAGE_E2E_BASE_URL); the main e2e job reads production.",
);

// The local seed's Head of mortgages (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const HEAD = { email: "yasmin.abdalla@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };

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
  await page.getByRole("textbox", { name: "Work email" }).fill(HEAD.email);
  await page.getByRole("textbox", { name: "Password" }).fill(HEAD.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // The login page is itself under /admin: wait until we've left it.
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"));
}

test("C1: the file you open is highlighted when you come back", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/mortgages");
  // The seeded row: the apply specs submit applications under the same name.
  await page.locator('tr[data-reference="BZM-26-0412"]').getByRole("link", { name: "Priya Raman" }).click();
  await expect(page).toHaveURL(/\/admin\/mortgages\/BZM-26-0412$/);
  await expect(page.getByRole("heading", { name: "Salaried document set" })).toBeVisible();
  await page.goBack();
  await expect(page.locator('tr[data-reference="BZM-26-0412"]')).toHaveAttribute("data-highlighted", "true");
  await expect(page.locator("tr[data-highlighted]")).toHaveCount(1);
});

test("C1: 'Show only these' leaves the files inside their last four hours", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/mortgages");
  const banner = page.getByRole("status").filter({ hasText: "inside their last 4 hours" });
  await expect(banner).toContainText("2 pre-approvals are inside their last 4 hours.");
  await banner.getByRole("button", { name: "Show only these" }).click();
  await expect(page).toHaveURL(/risk=1/);
  await expect(page.locator("tbody tr[data-reference]")).toHaveCount(2);
  await banner.getByRole("button", { name: "Show all" }).click();
  await expect(page.locator("tbody tr[data-reference]")).not.toHaveCount(2);
});

test("C6: a consultancy goes New → Contacted → Consultation booked → Completed", async ({ page, request }) => {
  // A fresh request through the website's own endpoint, so the spec can run again.
  const res = await request.post("/api/mortgage/requests", {
    headers: { "idempotency-key": randomUUID() },
    data: {
      service: "consultancy",
      entryPoint: "calculator_advisor",
      details: {
        residency: "uae_national",
        employmentType: "salaried",
        fullName: "Hessa Al Mazrouei",
        dateOfBirth: "1991-04-12",
        mobile: `+97150${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
        email: `hessa-${randomUUID().slice(0, 8)}@example.com`,
      },
    },
  });
  expect(res.status(), "the flow's flag must be public on this stack").toBe(201);
  const { reference } = (await res.json()) as { reference: string };

  await signIn(page);
  await page.goto(`/admin/mortgages/${reference}`);
  await expect(page.getByText(/not contacted yet/)).toBeVisible();
  await expect(page.getByText("Log a contact attempt before booking.")).toBeVisible();

  await page.getByRole("button", { name: "No answer" }).click();
  await expect(page.getByText(/first contact \d\d:\d\d/)).toBeVisible();
  await expect(page.getByText(/called · no answer/)).toBeVisible();

  await page.locator('[role="radiogroup"][aria-labelledby="book-time"] [role="radio"]:not([aria-disabled="true"])').first().click();
  const book = page.getByRole("button", { name: /^Book [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d\d:\d\d$/ });
  await expect(book).toBeEnabled();
  await book.click();
  await expect(page.getByRole("button", { name: "Mark consultation held" })).toBeVisible();
  await expect(page.getByText(/booked [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} · \d\d:\d\d/)).toBeVisible();

  await page.getByRole("button", { name: "Mark consultation held" }).click();
  await expect(page.getByText(/^Completed today \d\d:\d\d$/)).toBeVisible();
  await expect(page.getByText(/marked the consultation held/)).toBeVisible();
});
