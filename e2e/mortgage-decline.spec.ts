import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * Declining a Fast Pre-Approval (decision D19): from C2, a reason, the
 * message the applicant will read, and Decline & notify. The file is then
 * Declined, with the decision on the page and the request under C1's Closed.
 *
 * Each run makes its own application in the local database container, so it
 * never uses up a seeded one and can run again. So it runs only against a
 * stack on this machine — `npm run db:local:reset`, the dev server on :3107.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
const LOCAL = !!BASE && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE);
test.skip(!LOCAL, "Runs only against the local stack (MORTGAGE_E2E_BASE_URL=http://localhost:3107): it writes to its database.");

// The local seed's Head of mortgages (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const HEAD = { email: "yasmin.abdalla@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };
const YASMIN = "5eed0000-0000-4000-8000-000000000001";

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

/** A fresh Fast Pre-Approval in New, owned by Yasmin. */
function freshApplication(): string {
  const tag = randomUUID().slice(0, 8);
  const reference = sql(`
    select (public.mortgage_create_request(
      p_service => 'pre_approval', p_full_name => 'Maryam Declinetest', p_date_of_birth => '1988-05-02',
      p_mobile_e164 => '+971501234567', p_email => 'maryam-${tag}@example.com',
      p_residency => 'uae_resident_expat', p_employment_type => 'salaried', p_entry_point => 'direct',
      p_consent_version => 'v0.1', p_consent_text => 'Consent.', p_sla_due_at => now() + interval '2 days'
    )).reference`);
  expect(reference).toMatch(/^BZM-\d{2}-\d{4,}$/);
  sql(`update public.mortgage_requests set owner_staff_id = '${YASMIN}' where reference = '${reference}' returning 1`);
  return reference;
}

async function signIn(page: Page) {
  await page.context().addCookies([
    {
      name: "bz_consent",
      value: encodeURIComponent(
        JSON.stringify({ essential: true, analytics: false, marketing: false, decided_at: new Date().toISOString(), version: 1 }),
      ),
      url: BASE!,
    },
  ]);
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(HEAD.email);
  await page.getByRole("textbox", { name: "Password" }).fill(HEAD.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"));
}

test("C2: decline from New with a reason and the adviser's message; the file is Declined and Closed", async ({ page }) => {
  const reference = freshApplication();
  await signIn(page);
  await page.goto(`/admin/mortgages/${reference}`);

  await page.getByRole("button", { name: "Decline", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Decline Maryam's application" });
  await expect(dialog).toBeVisible();
  // Before the banks, "no bank made an offer" isn't offered: the message would say they were asked.
  await expect(dialog.getByRole("radio", { name: "No bank made an offer" })).toHaveCount(0);
  const confirm = dialog.getByRole("button", { name: "Decline & notify Maryam" });
  await expect(confirm).toBeDisabled();

  await dialog.getByRole("radio", { name: "Monthly debts too high (DBR)" }).click();
  const message = dialog.getByRole("textbox", { name: "Message to Maryam" });
  await expect(message).toHaveValue(/^Maryam, thank you for applying for Fast Pre-Approval with Bazar\./);
  await expect(message).toHaveValue(/UAE Central Bank rules cap your total monthly repayments/);
  await expect(message).toHaveValue(/\n\nYasmin$/);

  // "Other" has no words of its own: it can't go until the adviser says why.
  await dialog.getByRole("radio", { name: "Other" }).click();
  await expect(message).not.toHaveValue(/Central Bank/);
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByText("Say why in your own words before sending.")).toBeVisible();
  await dialog.getByRole("radio", { name: "Monthly debts too high (DBR)" }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByText("Declined. Maryam has been emailed.")).toBeVisible();
  await expect(dialog).toBeHidden();
  const decision = page.locator("section").filter({ has: page.getByRole("heading", { name: "Decision" }) });
  await expect(decision.getByText("Monthly debts too high (DBR)")).toBeVisible();
  await expect(decision.getByText(/UAE Central Bank rules cap your total monthly repayments/)).toBeVisible();
  await expect(page.getByText("Yasmin declined the application")).toBeVisible();
  await expect(page.getByRole("button", { name: "Decline", exact: true })).toHaveCount(0);

  // The applicant's email was queued and handed to the mailer (a dry run locally).
  await expect
    .poll(() => sql(`select count(*) from public.mortgage_notifications n join public.mortgage_requests r on r.id = n.request_id
                      where r.reference = '${reference}' and n.kind = 'decision_declined' and n.channel = 'email' and n.status <> 'queued'`))
    .toBe("1");

  await page.goto("/admin/mortgages?tab=closed");
  await expect(page.locator(`tr[data-reference="${reference}"]`)).toBeVisible();
});
