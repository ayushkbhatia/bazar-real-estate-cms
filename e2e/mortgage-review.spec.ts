import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * A re-upload, end to end (docs/mortgage PLAN Phase 5): the reviewer asks for
 * Priya's statements again in C4, Priya opens the secure link, enters her
 * code, uploads and sends (W8), and her file is back in review in C2. Opening
 * the link again says it has been used.
 *
 * The link's token and code exist only in emails, which the local stack
 * doesn't send (EMAIL_DRY_RUN), so the spec points the new link at a token of
 * its own and sets a code it knows, straight in the local database container.
 * So it runs only against a stack on this machine — `npm run db:local:reset`,
 * the dev server on :3107 — never staging or production.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
const LOCAL = !!BASE && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE);
test.skip(!LOCAL, "Runs only against the local stack (MORTGAGE_E2E_BASE_URL=http://localhost:3107): it writes to its database.");

// The local seed's Head of mortgages (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const HEAD = { email: "yasmin.abdalla@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };
const PRIYA = "BZM-26-0412";

/** A small, valid two-page PDF (lib/mortgage-requests/testing/fixtures.ts). */
const PDF = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUiA0IDAgUl0gL0NvdW50IDIgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNiAwIFIgPj4KZW5kb2JqCjUgMCBvYmoKPDwgL0xlbmd0aCAwID4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iago2IDAgb2JqCjw8IC9MZW5ndGggMCA+PgpzdHJlYW0KCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDEyMSAwMDAwMCBuIAowMDAwMDAwMjA4IDAwMDAwIG4gCjAwMDAwMDAyOTUgMDAwMDAgbiAKMDAwMDAwMDM0NCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDcgL1Jvb3QgMSAwIFIgL0lEIFs8MzY4NDU5ZTA0NDY2ZDNiNjNlYjVjZDYxNDA4MzE2OTE+IDwzNjg0NTllMDQ0NjZkM2I2M2ViNWNkNjE0MDgzMTY5MT5dID4+CnN0YXJ0eHJlZgozOTMKJSVFT0YK",
  "base64",
);

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

async function consented(context: BrowserContext) {
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
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(HEAD.email);
  await page.getByRole("textbox", { name: "Password" }).fill(HEAD.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"));
}

test("C4 → W8 → C2: a re-upload goes out, comes back, and the file is in review again", async ({ page, browser }) => {
  await consented(page.context());
  await signIn(page);

  // A run that stopped halfway leaves a request open: take it back (C2's confirm), so this one starts clean.
  await page.goto(`/admin/mortgages/${PRIYA}`);
  const leftover = page.getByRole("button", { name: "Cancel request" });
  if ((await leftover.count()) > 0) {
    await leftover.first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel request" }).click();
    await expect(page.getByText("Request cancelled.")).toBeVisible();
  }

  // C4: ask Priya for her statements again.
  await page.goto(`/admin/mortgages/${PRIYA}/documents/bank_statements_3m?reupload=1`);
  await page.getByRole("radio", { name: "Unreadable" }).click();
  await page.getByRole("textbox", { name: "Message to Priya" }).fill("The July statement is blurred. Please upload the original PDF.");
  await page.getByRole("button", { name: "Send request to Priya" }).click();
  await page.waitForURL(new RegExp(`/admin/mortgages/${PRIYA}$`));
  await expect(page.getByText("Awaiting applicant")).toBeVisible();
  await expect(page.getByText(/^Paused/)).toBeVisible();

  // The link's token is only in the email: point the new link at one of ours.
  const token = `e2e${randomUUID().replace(/-/g, "")}`;
  const linkId = sql(`
    update public.mortgage_access_links set token_hash = encode(sha256(convert_to('${token}', 'UTF8')), 'hex')
     where id = (
       select l.id from public.mortgage_access_links l join public.mortgage_requests r on r.id = l.request_id
        where r.reference = '${PRIYA}' and l.purpose = 'reupload' and l.used_at is null and l.revoked_at is null
        order by l.created_at desc limit 1)
    returning id`);
  expect(linkId).toMatch(/^[0-9a-f-]{36}$/);

  // W8, as Priya, in a browser of her own.
  const applicant = await browser.newContext({ baseURL: BASE });
  await consented(applicant);
  const w8 = await applicant.newPage();
  await w8.goto(`/mortgages/r/${token}`);
  await expect(w8.getByRole("heading", { name: "Check it's you" })).toBeVisible();
  await w8.getByRole("button", { name: "Send code" }).click();
  await expect(w8.getByText(/We sent a code to .+@example\.com/)).toBeVisible();

  // The code is only in the email too: set one we know.
  const code = "482913";
  expect(sql(`update public.mortgage_access_links set otp_hash = encode(sha256(convert_to(id::text || ':${code}', 'UTF8')), 'hex')
               where id = '${linkId}' and otp_sent_at is not null returning id`)).toBe(linkId);
  await w8.getByRole("textbox", { name: "Code" }).fill(code);
  await w8.getByRole("button", { name: "Continue" }).click();

  await expect(w8.getByRole("heading", { name: "One document needs another look" })).toBeVisible();
  await expect(w8.getByText("Unreadable", { exact: true })).toBeVisible();
  await expect(w8.getByRole("button", { name: "Send documents" })).toHaveAttribute("aria-disabled", "true");
  await w8.locator('input[type="file"]').setInputFiles({ name: "statement-jul-2026.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(w8.getByText(/ready to send/)).toBeVisible();
  await w8.getByRole("button", { name: "Send documents" }).click();
  await expect(w8.getByRole("heading", { name: "Thanks, Priya." })).toBeVisible();

  // Used: the link says so, and shows nothing else.
  await w8.goto(`/mortgages/r/${token}`);
  await expect(w8.getByRole("heading", { name: "You've already sent this" })).toBeVisible();
  await expect(w8.getByText(PRIYA)).toHaveCount(0);
  await applicant.close();

  // C2: back in review, the promise running again.
  await page.reload();
  await expect(page.getByText("Awaiting applicant")).toHaveCount(0);
  await expect(page.getByText(/^Paused/)).toHaveCount(0);
  await expect(page.getByText(/\d+h \d{2}m left|\d+m left/).first()).toBeVisible();
  await expect(page.getByText("Priya sent Last 3 months' bank statements").first()).toBeVisible();
});
