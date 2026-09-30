import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { requiredStatementMonths } from "../lib/mortgage-requests/documents";

/**
 * Priya's file, In review to Pre-approved (docs/mortgage PLAN Phase 6): the
 * last two documents accepted in C3, the file sent to the partner banks from
 * C2, two banks' offers recorded in C5 with their letters, the lead offer
 * chosen and the pre-approval confirmed. The applicant's email (with the
 * letter) and WhatsApp are queued; C1 then shows the file under Closed.
 *
 * Each run works on its own Priya, made as the seed makes her (BZM-26-0412),
 * with files of its own — so the seeded file stays in review for the
 * re-upload spec, and this one can run again whatever that one did. It writes
 * to the local database container and bucket, so it runs only against a stack
 * on this machine: `npm run db:local:reset`, the dev server on :3107.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
const LOCAL = !!BASE && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE);
test.skip(!LOCAL, "Runs only against the local stack (MORTGAGE_E2E_BASE_URL=http://localhost:3107): it writes to its database.");

// The local seed's Head of mortgages (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const HEAD = { email: "yasmin.abdalla@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };
const YASMIN = "5eed0000-0000-4000-8000-000000000001";

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

/** The local stack's storage, as its service role: only this machine's (scripts/db-local). */
function localStorage() {
  const out = execFileSync("supabase", ["status", "-o", "json", "--workdir", "scripts/db-local"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const status = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)) as Record<string, string>;
  expect(status.API_URL).toContain("127.0.0.1:55321");
  return createClient(status.API_URL!, status.SERVICE_ROLE_KEY!, { auth: { persistSession: false } }).storage.from("mortgage-files");
}

/**
 * Priya as the seed has her (BZM-26-0412), made again: her details, her Emirates ID and passport accepted, her
 * salary certificate checked with its figures recorded, and her statements for the months C3 asks for — to review.
 * Files of its own, bytes in the local bucket, so nothing another spec did to the seeded Priya reaches this one.
 */
async function copyOfPriya(): Promise<string> {
  const tag = randomUUID().slice(0, 8);
  const reference = sql(`
    select (public.mortgage_create_request(
      p_service => 'pre_approval', p_full_name => 'Priya Raman', p_date_of_birth => '1990-03-14',
      p_mobile_e164 => '+971502184417', p_email => 'priya-${tag}@example.com',
      p_residency => 'uae_resident_expat', p_employment_type => 'salaried', p_entry_point => 'calculator_preapproval',
      p_consent_version => 'v0.1', p_consent_text => 'Consent.', p_sla_due_at => now() + interval '2 days'
    )).reference`);
  expect(reference).toMatch(/^BZM-\d{2}-\d{4,}$/);
  const request = `(select id from public.mortgage_requests where reference = '${reference}')`;
  sql(`update public.mortgage_requests set owner_staff_id = '${YASMIN}' where reference = '${reference}' returning 1`);
  sql(`select (public.mortgage_transition(p_request_id => ${request}, p_event => 'first_document_opened',
         p_actor_kind => 'system', p_sla => '{}'::jsonb, p_data => '{}'::jsonb)).status`);

  const documents: Record<string, { accepted: boolean; checks: object; recorded?: object }> = {
    emirates_id: { accepted: true, checks: { name_matches: true, front_and_back: true, not_expired: true } },
    passport: { accepted: true, checks: { name_matches: true, photo_page_legible: true, not_expired: true } },
    salary_certificate: {
      accepted: false,
      checks: { name_matches: true, salary_stated: true, issued_recently: true, addressed_to_bank: true, signed_and_stamped: true },
      recorded: { monthly_gross_aed: 32500, employer: "Corniche Medical Centre L.L.C.", employed_since: "2019-04" },
    },
    bank_statements_3m: { accepted: false, checks: { holder_matches: true, issued_by_bank: true } },
  };
  for (const [kind, d] of Object.entries(documents)) {
    sql(`update public.mortgage_documents set
           state = '${d.accepted ? "accepted" : "to_review"}', checks = '${JSON.stringify(d.checks)}'::jsonb,
           recorded = '${JSON.stringify(d.recorded ?? {})}'::jsonb,
           accepted_by = ${d.accepted ? `'${YASMIN}'` : "null"}, accepted_at = ${d.accepted ? "now()" : "null"}
         where request_id = ${request} and kind = '${kind}' returning 1`);
  }

  // The statements cover the months C3 asks for: the three before this one, in Dubai.
  const months = requiredStatementMonths("bank_statements_3m", new Date());
  const files = [
    { kind: "emirates_id", name: "emirates-id.pdf", month: null },
    { kind: "passport", name: "passport.pdf", month: null },
    { kind: "salary_certificate", name: "salary-certificate.pdf", month: null },
    ...months.map((month) => ({ kind: "bank_statements_3m", name: `statement-${month}.pdf`, month })),
  ];
  const bucket = localStorage();
  for (const f of files) {
    const id = randomUUID();
    const { error } = await bucket.upload(`f/${id}`, PDF, { contentType: "application/pdf" });
    expect(error).toBeNull();
    const period = f.month ? `'${f.month}-01'::date, ('${f.month}-01'::date + interval '1 month' - interval '1 day')::date` : "null, null";
    sql(`insert into public.mortgage_files (id, document_id, kind, state, storage_key, original_name, mime, size_bytes,
                                            page_count, scan_status, period_from, period_to)
         select '${id}', d.id, '${f.kind}', 'active', 'f/${id}', '${f.name}', 'application/pdf', ${PDF.length}, 2, 'clean', ${period}
           from public.mortgage_documents d where d.request_id = ${request} and d.kind = '${f.kind}'
         returning 1`);
  }
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

/** C3: tick every check the reviewer hasn't, and accept. */
async function accept(page: Page, reference: string, kind: string) {
  await page.goto(`/admin/mortgages/${reference}/documents/${kind}`);
  const panel = page.locator("aside").filter({ has: page.getByRole("button", { name: "Accept document" }) });
  const boxes = panel.getByRole("checkbox");
  await expect(boxes.first()).toBeVisible();
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = boxes.nth(i);
    if ((await box.getAttribute("aria-checked")) !== "true") {
      await box.click();
      await expect(box).toHaveAttribute("aria-checked", "true");
    }
  }
  await panel.getByRole("button", { name: "Accept document" }).click();
  await expect(page.getByText("Document accepted.")).toBeVisible();
}

const validUntil = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

/** C5's "Record response": an offer, its figures and the bank's letter. */
async function recordOffer(page: Page, code: string, label: string, offer: { amount: number; rate: number; years: number; letter: string }) {
  await page.getByTestId(`bank-row-${code}`).getByRole("button", { name: "Record response" }).click();
  const dialog = page.getByRole("dialog", { name: `Record ${label}'s response` });
  await expect(dialog).toBeVisible();
  const save = dialog.getByRole("button", { name: "Save response" });
  await dialog.getByRole("textbox", { name: "Up to (AED)" }).fill(String(offer.amount));
  await dialog.getByRole("textbox", { name: "Rate (%)" }).fill(String(offer.rate));
  await dialog.getByRole("textbox", { name: "Fixed for (years)" }).fill(String(offer.years));
  await dialog.getByLabel("Valid until").fill(validUntil);
  // No letter yet: an offer can't be saved without one.
  await expect(save).toBeDisabled();
  await dialog.locator('input[type="file"]').setInputFiles({ name: offer.letter, mimeType: "application/pdf", buffer: PDF });
  await expect(dialog.getByText(offer.letter)).toBeVisible();
  await save.click();
  await expect(page.getByText(`${label}'s response is recorded.`)).toBeVisible();
  await expect(dialog).toBeHidden();
}

test("Priya: In review → With banks → Pre-approved, with the lead bank's letter, and Closed in C1", async ({ page }) => {
  test.setTimeout(180_000);
  const reference = await copyOfPriya();
  await signIn(page);

  // C2: two documents still to review, so the file can't go to the banks yet.
  await page.goto(`/admin/mortgages/${reference}`);
  await expect(page.getByRole("button", { name: "Accept application" })).toBeDisabled();
  await accept(page, reference, "salary_certificate");
  await accept(page, reference, "bank_statements_3m");

  // C2: every document accepted, consent on file — to the banks.
  await page.goto(`/admin/mortgages/${reference}`);
  await page.getByRole("button", { name: "Accept application" }).click();
  const send = page.getByRole("dialog", { name: "Send Priya's file to partner banks" });
  // Every bank that can take a package starts ticked; send to the seeded three.
  const seeded = /\b(First Abu Dhabi Bank|Abu Dhabi Commercial Bank|Mashreq)\b/;
  const boxes = send.getByRole("checkbox");
  for (let i = 0; i < (await boxes.count()); i++) {
    const box = boxes.nth(i);
    const name = (await box.locator("xpath=ancestor::label[1]").innerText()).trim();
    if (!(await box.isDisabled())) await box.setChecked(seeded.test(name));
  }
  await send.getByRole("button", { name: "Send to 3 banks" }).click();
  // The local stack sends no email (EMAIL_DRY_RUN): the answer says so rather than "Sent" (SR-25).
  await expect(
    page.getByText("The file is with the banks, but this site isn't sending email, so nothing went to FAB, ADCB and Mashreq."),
  ).toBeVisible();
  await expect(page.getByText("Package sent to FAB, ADCB and Mashreq").first()).toBeVisible();

  // C5: every bank waiting; two answer with offers and letters.
  await page.getByRole("link", { name: "Open decision" }).click();
  await page.waitForURL(new RegExp(`/admin/mortgages/${reference}/decision$`));
  await expect(page.getByTestId("bank-row-MSQ").getByText(/^Awaiting reply · sent/)).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm pre-approval & notify Priya" });
  await expect(confirm).toBeDisabled();

  await recordOffer(page, "ADCB", "ADCB", { amount: 2_000_000, rate: 4.15, years: 3, letter: `ADCB-pre-approval-${reference}.pdf` });
  await recordOffer(page, "FAB", "FAB", { amount: 2_150_000, rate: 3.99, years: 3, letter: `FAB-pre-approval-${reference}.pdf` });

  // The 25-year monthly payment, from payments.ts: AED 2,150,000 at 3.99% is AED 11,337.
  await expect(page.getByTestId("bank-row-FAB")).toContainText("AED 11,337");
  await expect(page.getByTestId("bank-row-ADCB")).toContainText("AED 10,723");

  // The largest offer leads until the adviser picks another; the card and the message follow it.
  const card = page.getByRole("tabpanel");
  await expect(card).toContainText("FAB · up to AED 2,150,000");
  await expect(card).toContainText(`FAB-pre-approval-${reference}.pdf`);
  const message = page.getByRole("textbox", { name: "Message to Priya" });
  await expect(message).toHaveValue(
    /^Good news, Priya: you're pre-approved\. First Abu Dhabi Bank has pre-approved you for up to AED 2,150,000 at 3\.99% fixed for 3 years, valid until \d{1,2} \w+ \d{4}\. ADCB has also pre-approved you for up to AED 2,000,000\.\n\nI'll call you tomorrow morning to talk through both\. Yasmin$/,
  );
  await page.getByRole("radio", { name: /^Abu Dhabi Commercial Bank/ }).check();
  await expect(card).toContainText("ADCB · up to AED 2,000,000");
  await expect(message).toHaveValue(/^Good news, Priya: you're pre-approved\. Abu Dhabi Commercial Bank has pre-approved you/);
  await page.getByRole("radio", { name: /^First Abu Dhabi Bank/ }).check();
  await expect(card).toContainText("FAB · up to AED 2,150,000");

  // Mashreq hasn't answered: confirming withdraws it, and the note says so.
  await expect(page.getByText("The bank still deciding is withdrawn, and its link stops working.")).toBeVisible();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // Back on C2, decided.
  await page.waitForURL(new RegExp(`/admin/mortgages/${reference}$`));
  const decision = page.locator("section").filter({ has: page.getByRole("heading", { name: "Decision" }) });
  await expect(decision.getByText("Pre-approved", { exact: true })).toBeVisible();
  await expect(decision.getByText(/First Abu Dhabi Bank has pre-approved you for up to AED 2,150,000/)).toBeVisible();
  await expect(page.getByText("Yasmin sent the pre-approval").first()).toBeVisible();
  await expect(page.getByText(/^Met · /)).toBeVisible();

  // The applicant's email (with the letter) went to the mailer — a dry run locally — and WhatsApp is recorded as skipped (D1).
  const outbox = (channel: string) =>
    sql(`select n.status from public.mortgage_notifications n join public.mortgage_requests r on r.id = n.request_id
          where r.reference = '${reference}' and n.kind = 'decision_pre_approved' and n.channel = '${channel}'`);
  await expect.poll(() => outbox("email")).toMatch(/^(sent|skipped)$/);
  expect(outbox("whatsapp")).toBe("skipped");
  expect(
    sql(`select s.status from public.mortgage_bank_submissions s join public.mortgage_requests r on r.id = s.request_id
          join public.mortgage_partner_banks b on b.id = s.bank_id where r.reference = '${reference}' and b.code = 'MSQ'`),
  ).toBe("withdrawn");

  // Later, Priya withdraws her consent (SR-17): recorded from C2's Consent card, and every bank's link stops (SR-22).
  await page.goto(`/admin/mortgages/${reference}`);
  const consent = page.getByTestId("consent-card");
  await consent.getByRole("button", { name: "Record a withdrawal" }).click();
  await page.getByRole("dialog", { name: "Record a withdrawal of consent?" }).getByRole("button", { name: "Record withdrawal" }).click();
  await expect(page.getByText("Priya's withdrawal is recorded. The banks' links have stopped.")).toBeVisible();
  await expect(consent.getByText(/^Withdrawn /)).toBeVisible();
  await expect(consent.getByRole("button", { name: "Record a withdrawal" })).toHaveCount(0);
  await expect(page.getByText("Yasmin recorded Priya's withdrawal of consent").first()).toBeVisible();
  expect(
    sql(`select count(*) from public.mortgage_bank_submissions s join public.mortgage_requests r on r.id = s.request_id
          where r.reference = '${reference}' and s.package_expires_at > now()`),
  ).toBe("0");

  // C5 is read-only now, and C1 files the request under Closed.
  await page.goto(`/admin/mortgages/${reference}/decision`);
  await expect(page.getByRole("button", { name: "Confirm pre-approval & notify Priya" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record response" })).toHaveCount(0);
  await page.goto("/admin/mortgages?tab=closed");
  await expect(page.locator(`tr[data-reference="${reference}"]`)).toContainText("Pre-approved");
});
