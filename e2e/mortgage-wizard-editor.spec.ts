import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * Pages & blocks → Wizards → Mortgage application (Bazar, 9 Oct 2026): an
 * edit in the editor is what the wizard says on its next screen, and the
 * Flow switches change what it shows. Writes the wizard's document, so local
 * only, and deletes it again at the end.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
const LOCAL = !!BASE && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE);
test.skip(!LOCAL, "Runs only against the local stack (MORTGAGE_E2E_BASE_URL=http://localhost:3107): it writes to its database.");

// The local seed's admin (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const ADMIN = { email: "mariam.alhashimi@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };
const SHOTS = process.env.MORTGAGE_E2E_SHOTS;

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_bazar-local", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

const SLUG = "subpage/wizard/mortgage-application";

async function signIn(page: Page) {
  await page.context().addCookies([
    {
      name: "bz_consent",
      value: encodeURIComponent(JSON.stringify({ essential: true, analytics: false, marketing: false, decided_at: new Date().toISOString(), version: 1 })),
      url: BASE!,
    },
  ]);
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(ADMIN.email);
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"));
}

/** Open a section of the editor by its label. */
async function openSection(page: Page, label: string) {
  const row = page.locator("li").filter({ has: page.getByText(label, { exact: true }) }).first();
  const field = row.locator("input, textarea").first();
  if (!(await field.isVisible().catch(() => false))) await row.getByText(label, { exact: true }).click();
  return row;
}

test.afterAll(() => {
  sql(`delete from public.pages where slug = '${SLUG}'`);
});

test("an edit in Pages & blocks → Wizards is what the wizard says, and Flow changes what it shows", async ({ page }) => {
  test.setTimeout(120_000);
  sql(`delete from public.pages where slug = '${SLUG}'`);
  await signIn(page);

  await page.goto("/admin/pages");
  await page.getByRole("link", { name: /Mortgage application/ }).click();
  await page.waitForURL(/\/admin\/pages\/wizards\/mortgage-application$/);
  await expect(page.getByText("Every screen, word for word")).toBeVisible();

  // Step 1's heading.
  const w1 = await openSection(page, "Step 1 · Choose a service");
  const title = w1.getByRole("textbox", { name: "Title", exact: true });
  await expect(title).toHaveValue("How can we assist you?");
  await title.fill("Which service suits you?");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wizard-editor.png`, fullPage: false });

  // A placeholder dropped from a message is refused, and nothing is saved.
  const w8 = await openSection(page, "Secure link");
  const reference = w8.getByRole("textbox", { name: /^Invite · reference/ });
  const original = await reference.inputValue();
  expect(original).toContain("{reference}");
  await reference.fill("Your application is in.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Keep \{reference\}/)).toBeVisible();
  expect(sql(`select count(*) from public.pages where slug = '${SLUG}'`)).toBe("0");
  await reference.fill(original);

  // Flow: Fast Pre-Approval first, Step 1's side panel off.
  const flow = await openSection(page, "Flow");
  await flow.getByRole("combobox").first().selectOption("pre_approval");
  await flow.getByRole("checkbox", { name: /Step 1's side panel/ }).uncheck();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved\./).first()).toBeVisible();
  // Only what differs from the catalogue is stored.
  const stored = sql(`select blocks::text from public.pages where slug = '${SLUG}'`);
  expect(stored).toContain("Which service suits you?");
  expect(stored).not.toContain("Tell us about yourself");

  await page.goto("/mortgages/apply");
  await expect(page.getByRole("heading", { level: 1, name: "Which service suits you?" })).toBeVisible();
  const cards = page.getByRole("radiogroup").getByRole("radio");
  await expect(cards.first()).toHaveAccessibleName(/Fast Pre-Approval/);
  await expect(page.getByText("Which one is right for you?")).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wizard-live.png`, fullPage: false });
});
