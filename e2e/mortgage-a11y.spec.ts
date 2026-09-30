import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Axe on every mortgage screen (PLAN Phase 7, step 5): the website flow W1–W8
 * and the bank's package page, then the team's CMS C1–C6 with its dialogs,
 * the partner banks page and the settings. WCAG 2.1 A and AA, as e2e/a11y.spec.ts
 * holds the rest of the site to; every violation fails the screen it's on.
 *
 * The flow submits applications and the CMS needs the seed's staff, so it
 * runs only against the local stack (`npm run db:local:reset`, the dev server
 * on :3107), like the other mortgage specs.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
const LOCAL = !!BASE && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE);
test.skip(!LOCAL, "Runs only against the local stack (MORTGAGE_E2E_BASE_URL=http://localhost:3107): it writes to its database.");

// The local seed's Head of mortgages (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const HEAD = { email: "yasmin.abdalla@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const PDF = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUiA0IDAgUl0gL0NvdW50IDIgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNiAwIFIgPj4KZW5kb2JqCjUgMCBvYmoKPDwgL0xlbmd0aCAwID4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iago2IDAgb2JqCjw8IC9MZW5ndGggMCA+PgpzdHJlYW0KCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDEyMSAwMDAwMCBuIAowMDAwMDAwMjA4IDAwMDAwIG4gCjAwMDAwMDAyOTUgMDAwMDAgbiAKMDAwMDAwMDM0NCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDcgL1Jvb3QgMSAwIFIgL0lEIFs8MzY4NDU5ZTA0NDY2ZDNiNjNlYjVjZDYxNDA4MzE2OTE+IDwzNjg0NTllMDQ0NjZkM2I2M2ViNWNkNjE0MDgzMTY5MT5dID4+CnN0YXJ0eHJlZgozOTMKJSVFT0YK",
  "base64",
);
const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: PDF });
function jpeg(name: string) {
  const b = Buffer.alloc(4096);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return { name, mimeType: "image/jpeg", buffer: b };
}

/** SQL as the local database's superuser, in its container. Values here are the spec's own, never input. */
function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_bazar-local", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", query],
    { encoding: "utf8" },
  )
    .split("\n")[0]!
    .trim();
}

/**
 * The CMS shell's sidebar (components/brand/cms-shell.tsx) is shared by every
 * admin page and isn't the mortgage module's to change; its group labels are
 * tracked on their own. Everything else on these pages is.
 */
const SHARED_SHELL = "aside.py-5.px-3\\.5";

/** Every WCAG A/AA violation on the page as it stands, one line each, soft so a run lists them all. */
async function audit(page: Page, screen: string) {
  // After a step changes on the client, the route's <title> streams in a moment after its content.
  await expect(page).toHaveTitle(/\S/);
  // A colour mid-transition isn't the colour anyone reads: measure the settled page.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).exclude(SHARED_SHELL).analyze();
  const lines = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`,
  );
  expect.soft(lines, `${screen}: axe violations`).toEqual([]);
}

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

async function choose(page: Page, name: string) {
  const radio = page.getByRole("radio", { name, exact: true });
  await page.locator("label").filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

async function details(page: Page, employment: "Salaried" | "Business Owner", email: string) {
  await expect(page.getByRole("heading", { level: 1, name: "Personal details" })).toBeVisible();
  await choose(page, "UAE Resident / Expat");
  await choose(page, employment);
  await page.getByLabel("Full name").fill("Priya Raman");
  await page.getByLabel("Date of birth").pressSequentially("14031990");
  await page.getByLabel("Mobile number, +971").fill("50 218 4417");
  await page.getByLabel("Email address").fill(email);
}

// ── The website ──────────────────────────────────────────────────

test("W1 → W2 (with its errors) → W3 → W4: Mortgage Consultancy", async ({ page }) => {
  await page.goto("/mortgages/apply?service=consultancy&from=services_menu");
  await expect(page.getByRole("radio", { name: "Mortgage Consultancy" })).toBeChecked();
  await audit(page, "W1");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Personal details" })).toBeVisible();
  await audit(page, "W2");
  // Continuing empty shows every field's error.
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await audit(page, "W2 with errors");

  await details(page, "Salaried", `a11y-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page).toHaveURL(/\/mortgages\/apply\/review$/);
  await audit(page, "W3");
  await page.getByRole("button", { name: "Request a Consultation" }).click();
  await expect(page).toHaveURL(/\/mortgages\/apply\/received$/);
  await audit(page, "W4");
});

test("W5 (empty, then with files) → W7: Fast Pre-Approval", async ({ page }) => {
  await page.goto("/mortgages/apply?service=pre_approval&from=home");
  await page.getByRole("button", { name: "Continue" }).click();
  await details(page, "Salaried", `a11y-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByRole("button", { name: "Continue to documents" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload your salaried documents");
  await audit(page, "W5");

  const row = (name: string) => page.getByRole("group", { name });
  await row("Emirates ID").locator('input[type="file"]').setInputFiles([jpeg("emirates-id-front.jpg"), jpeg("emirates-id-back.jpg")]);
  await row("Passport copy").locator('input[type="file"]').setInputFiles(pdf("passport.pdf"));
  await row("Salary certificate").locator('input[type="file"]').setInputFiles(pdf("salary-certificate.pdf"));
  await row("Last 3 months' bank statements")
    .locator('input[type="file"]')
    .setInputFiles([pdf("statement-jun-2026.pdf"), pdf("statement-jul-2026.pdf"), pdf("statement-aug-2026.pdf")]);
  await expect(page.getByText("4 of 4 ready")).toBeVisible();
  await audit(page, "W5 with every document added");

  const consent = page.getByRole("checkbox");
  await page.locator("label").filter({ has: consent }).click();
  await page.getByRole("button", { name: "Get Fast Pre-Approval" }).click();
  await expect(page).toHaveURL(/\/mortgages\/apply\/received$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you.");
  await audit(page, "W7");
});

test("By keyboard alone: each step's heading takes focus, errors take it to the field, Enter chooses files", async ({ page }) => {
  await page.goto("/mortgages/apply?service=pre_approval&from=home");
  await page.getByRole("button", { name: "Continue" }).press("Enter");
  // The new step's heading has focus, so a screen reader announces where the reader is.
  await expect(page.getByRole("heading", { level: 1, name: "Personal details" })).toBeFocused();

  // Continuing with nothing filled in announces the errors and moves focus to the first field that needs attention.
  await page.getByRole("button", { name: "Continue to documents" }).press("Enter");
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(await page.evaluate(() => document.activeElement !== document.body && !!document.activeElement?.closest("form"))).toBe(true);

  await details(page, "Salaried", `a11y-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByRole("button", { name: "Continue to documents" }).press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Upload your salaried documents" })).toBeFocused();

  // Tab from the heading to the Emirates ID's upload button; Enter opens the file picker.
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(
      () =>
        /^Upload documents?$/.test(document.activeElement?.textContent?.trim() ?? "") &&
        !!document.activeElement?.closest('[role="group"]')?.textContent?.includes("Emirates ID"),
    );
  }
  expect(reached, "the Emirates ID's upload button is reachable with Tab").toBe(true);
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles([jpeg("emirates-id-front.jpg"), jpeg("emirates-id-back.jpg")]);
  await expect(page.getByRole("group", { name: "Emirates ID" })).toContainText("Added");
});

test("W6 in every row state (the design gallery)", async ({ page }) => {
  await page.goto("/mortgages/apply/gallery");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await audit(page, "W6 gallery");
});

test("W8: the code, then the re-upload", async ({ page }) => {
  // Karim's seeded re-upload: point its link at a token of ours.
  const token = `a11y${randomUUID().replace(/-/g, "")}`;
  const linkId = sql(`
    update public.mortgage_access_links set token_hash = encode(sha256(convert_to('${token}', 'UTF8')), 'hex'),
           otp_attempts = 0, otp_sent_at = null
     where id = (
       select l.id from public.mortgage_access_links l join public.mortgage_requests r on r.id = l.request_id
        where r.reference = 'BZM-26-0409' and l.purpose = 'reupload' and l.used_at is null and l.revoked_at is null
        order by l.created_at desc limit 1)
    returning id`);
  expect(linkId).toMatch(/^[0-9a-f-]{36}$/);

  await page.goto(`/mortgages/r/${token}`);
  await expect(page.getByRole("heading", { name: "Check it's you" })).toBeVisible();
  await audit(page, "W8 code gate");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(/We sent a code to/)).toBeVisible();
  await audit(page, "W8 code sent");

  const code = "482913";
  sql(`update public.mortgage_access_links set otp_hash = encode(sha256(convert_to(id::text || ':${code}', 'UTF8')), 'hex')
        where id = '${linkId}' returning id`);
  await page.getByRole("textbox", { name: "Code" }).fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Send documents" })).toBeVisible();
  await audit(page, "W8");

  await page.goto(`/mortgages/r/not-a-real-token-${randomUUID()}`);
  await audit(page, "W8 unavailable");
});

test("A bank's package page", async ({ page }) => {
  const token = `a11y${randomUUID().replace(/-/g, "")}`;
  const id = sql(`
    update public.mortgage_bank_submissions s set package_token_hash = encode(sha256(convert_to('${token}', 'UTF8')), 'hex'),
           package_expires_at = now() + interval '7 days'
      from public.mortgage_requests r, public.mortgage_partner_banks b
     where r.id = s.request_id and b.id = s.bank_id and r.reference = 'BZM-26-0404' and b.code = 'MSQ'
    returning s.id`);
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  await page.goto(`/mortgages/p/${token}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await audit(page, "Package");
});

// ── The team's CMS ───────────────────────────────────────────────

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(HEAD.email);
  await page.getByRole("textbox", { name: "Password" }).fill(HEAD.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"));
}

test("C1–C6, their dialogs, the banks page and the settings", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);

  await page.goto("/admin/mortgages");
  await expect(page.getByRole("table")).toBeVisible();
  await audit(page, "C1");

  await page.goto("/admin/mortgages/BZM-26-0412");
  await expect(page.getByText("Salaried document set")).toBeVisible();
  await audit(page, "C2");
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await page.getByRole("dialog").getByRole("radio", { name: "Monthly debts too high (DBR)" }).click();
  await audit(page, "C2 · Decline");
  await page.keyboard.press("Escape");
  // Opened and cancelled: the seeded consent stays on file.
  await page.getByTestId("consent-card").getByRole("button", { name: "Record a withdrawal" }).click();
  await expect(page.getByRole("dialog", { name: "Record a withdrawal of consent?" })).toBeVisible();
  await audit(page, "C2 · Record a withdrawal");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto("/admin/mortgages/BZM-26-0412/documents/salary_certificate");
  await expect(page.getByRole("button", { name: "Accept document" })).toBeVisible();
  await audit(page, "C3");

  await page.goto("/admin/mortgages/BZM-26-0412/documents/bank_statements_3m?reupload=1");
  await expect(page.getByRole("button", { name: /Send request to Priya/ })).toBeVisible();
  await audit(page, "C4");

  await page.goto("/admin/mortgages/BZM-26-0398/decision");
  await expect(page.getByRole("button", { name: "Confirm pre-approval & notify Arjun" })).toBeVisible();
  await audit(page, "C5");
  await page.getByTestId("bank-row-MSQ").getByRole("button", { name: "Record response" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit(page, "C5 · Record response");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Decline" }).click();
  await audit(page, "C5 · Decline tab");

  await page.goto("/admin/mortgages/BZM-26-0415");
  await expect(page.getByRole("heading", { name: "Contact log" })).toBeVisible();
  await audit(page, "C6");

  await page.goto("/admin/mortgages/banks");
  await audit(page, "Partner banks");
  await page.goto("/admin/mortgages/settings");
  await audit(page, "Settings");
});
