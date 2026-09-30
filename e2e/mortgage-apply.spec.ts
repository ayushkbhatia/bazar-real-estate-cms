import { expect, test, type Page } from "@playwright/test";

/**
 * The mortgage application flow, end to end (docs/mortgage PLAN Phase 3):
 * Path A (Mortgage Consultancy), Path B (Fast Pre-Approval, salaried),
 * Path C (Fast Pre-Approval, business owner) with the oversize-licence error.
 *
 * These submit real applications and upload real files, so they run only
 * against a local or staging stack — never the production database the main
 * e2e job reads. See playwright.mortgage.config.ts.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
test.skip(
  !BASE,
  "Runs only against a local or staging stack (set MORTGAGE_E2E_BASE_URL); the main e2e job reads production.",
);

const MB = 1_048_576;

/** A small, valid two-page PDF (pdf.js opens it; see lib/mortgage-requests/testing/fixtures.ts). */
const PDF = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUiA0IDAgUl0gL0NvdW50IDIgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNiAwIFIgPj4KZW5kb2JqCjUgMCBvYmoKPDwgL0xlbmd0aCAwID4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iago2IDAgb2JqCjw8IC9MZW5ndGggMCA+PgpzdHJlYW0KCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDEyMSAwMDAwMCBuIAowMDAwMDAwMjA4IDAwMDAwIG4gCjAwMDAwMDAyOTUgMDAwMDAgbiAKMDAwMDAwMDM0NCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDcgL1Jvb3QgMSAwIFIgL0lEIFs8MzY4NDU5ZTA0NDY2ZDNiNjNlYjVjZDYxNDA4MzE2OTE+IDwzNjg0NTllMDQ0NjZkM2I2M2ViNWNkNjE0MDgzMTY5MT5dID4+CnN0YXJ0eHJlZgozOTMKJSVFT0YK",
  "base64",
);

/** A JPEG as far as a type sniffer is concerned: the magic bytes, then padding. */
function jpeg(size = 4096): Buffer {
  const b = Buffer.alloc(size);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
}

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: PDF });

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

type Person = {
  residency: "UAE National" | "UAE Resident / Expat";
  employment: "Salaried" | "Business Owner";
  name: string;
  dob: string;
  mobile: string;
  email: string;
};

/** Click a tile or card the way a person does — the whole label — and check it took. */
async function choose(page: Page, name: string) {
  const radio = page.getByRole("radio", { name, exact: true });
  await page.locator("label").filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

async function consent(page: Page) {
  const box = page.getByRole("checkbox");
  await page.locator("label").filter({ has: box }).click();
  await expect(box).toBeChecked();
}

async function fillDetails(page: Page, p: Person) {
  await expect(page.getByRole("heading", { level: 1, name: "Personal details" })).toBeVisible();
  await choose(page, p.residency);
  await choose(page, p.employment);
  await page.getByLabel("Full name").fill(p.name);
  await page.getByLabel("Date of birth").pressSequentially(p.dob.replace(/\D/g, ""));
  await page.getByLabel("Mobile number, +971").fill(p.mobile);
  await page.getByLabel("Email address").fill(p.email);
}

function row(page: Page, document: string) {
  return page.getByRole("group", { name: document });
}

async function upload(page: Page, document: string, files: Parameters<Page["setInputFiles"]>[1]) {
  await row(page, document).locator('input[type="file"]').setInputFiles(files);
}

test("Path A · Mortgage Consultancy from the services menu", async ({ page, browser }) => {
  await page.goto("/mortgages/apply?service=consultancy&from=services_menu");
  await expect(page.getByRole("radio", { name: "Mortgage Consultancy" })).toBeChecked();
  // The stepper's last step names consultancy's end.
  await expect(page.getByRole("list", { name: "Application progress" })).toContainText("Submit");
  await page.getByRole("button", { name: "Continue" }).click();

  await fillDetails(page, {
    residency: "UAE National",
    employment: "Salaried",
    name: "Ahmed Al Suwaidi",
    dob: "02/11/1986",
    mobile: "+971 50 774 1290",
    email: "Ahmed.Suwaidi@example.com",
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page).toHaveURL(/\/mortgages\/apply\/review$/);
  await expect(page.getByText("+971 50 774 1290")).toBeVisible();
  await expect(page.getByText("ahmed.suwaidi@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Request a Consultation" }).click();

  await expect(page).toHaveURL(/\/mortgages\/apply\/received$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you for your interest.");
  await expect(page.getByText(/^BZM-\d{2}-\d{4,}$/)).toBeVisible();
  // No reference or personal data in the URL.
  expect(page.url()).not.toMatch(/BZM|ahmed|971/i);

  // Reload keeps it; Back can't resubmit.
  await page.reload();
  await expect(page.getByText(/^BZM-\d{2}-\d{4,}$/)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/mortgages\/apply\/received$/);

  // A fresh tab has nothing to show and goes back to the start.
  const other = await browser.newPage();
  await other.goto(`${BASE}/mortgages/apply/received`);
  await expect(other).toHaveURL(/\/mortgages\/apply$/);
  await other.close();
});

test("Path B · Fast Pre-Approval, salaried, from the home page", async ({ page }) => {
  await page.goto("/mortgages/apply?service=pre_approval&from=home");
  await expect(page.getByRole("radio", { name: "Fast Pre-Approval" })).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();

  await fillDetails(page, {
    residency: "UAE Resident / Expat",
    employment: "Salaried",
    name: "Priya Raman",
    dob: "14031990",
    mobile: "50 218 4417",
    email: "priya.raman@example.com",
  });
  await page.getByRole("button", { name: "Continue to documents" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload your salaried documents");
  const cta = page.getByRole("button", { name: "Get Fast Pre-Approval" });
  await expect(cta).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("0 of 4 documents added")).toBeVisible();

  await upload(page, "Emirates ID", [
    { name: "emirates-id-front.jpg", mimeType: "image/jpeg", buffer: jpeg() },
    { name: "emirates-id-back.jpg", mimeType: "image/jpeg", buffer: jpeg() },
  ]);
  await upload(page, "Passport copy", pdf("passport-photo-page.pdf"));
  await upload(page, "Salary certificate", pdf("salary-certificate.pdf"));
  await upload(page, "Last 3 months' bank statements", [
    pdf("statement-jun-2026.pdf"),
    pdf("statement-jul-2026.pdf"),
    pdf("statement-aug-2026.pdf"),
  ]);
  await expect(row(page, "Last 3 months' bank statements")).toContainText("3 files added");
  await expect(page.getByText("4 of 4 ready")).toBeVisible();
  // Everything ready, consent not given: still closed.
  await expect(cta).toHaveAttribute("aria-disabled", "true");

  await consent(page);
  await expect(cta).not.toHaveAttribute("aria-disabled");
  await cta.click();

  await expect(page).toHaveURL(/\/mortgages\/apply\/received$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you.");
  await expect(page.getByText("We'll contact you by")).toBeVisible();
  await expect(page.getByText("+971 50 ••• 4417")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Emirates ID" })).toContainText("2 files");
  await expect(page.getByRole("listitem").filter({ hasText: "Last 3 months' bank statements" })).toContainText("3 files");
});

test("Path C · Fast Pre-Approval, business owner, with an oversize licence", async ({ page }) => {
  await page.goto("/mortgages/apply?service=pre_approval&from=calculator_preapproval");
  await page.getByRole("button", { name: "Continue" }).click();
  await fillDetails(page, {
    residency: "UAE National",
    employment: "Business Owner",
    name: "Karim Haddad",
    dob: "21071984",
    mobile: "055 123 2290",
    email: "karim.haddad@example.com",
  });
  await page.getByRole("button", { name: "Continue to documents" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload your business documents");
  await expect(row(page, "Last 1 year's bank statements")).toContainText(/\w{3} \d{4} to \w{3} \d{4}/);

  // Too big: refused before a byte is sent, and the CTA stays shut.
  const big = Buffer.alloc(Math.round(14.8 * MB));
  big.set(Buffer.from("%PDF-1.4"));
  await upload(page, "Business trade licence", { name: "trade-license-scan.pdf", mimeType: "application/pdf", buffer: big });
  const licence = row(page, "Business trade licence");
  await expect(licence).toContainText("Needs attention");
  await expect(licence).toContainText(
    "This file is 14.8 MB and the limit is 10 MB. Save it at a lower resolution, or upload a photo of the licence instead.",
  );
  await expect(page.getByText("1 file needs attention")).toBeVisible();

  // Choose another file replaces the failed line.
  const chooser = page.waitForEvent("filechooser");
  await licence.getByRole("button", { name: "Choose another file" }).click();
  await (await chooser).setFiles(pdf("trade-licence.pdf"));
  await expect(licence).toContainText("Added");
  await expect(licence).not.toContainText("trade-license-scan.pdf");

  await upload(page, "Emirates ID", pdf("emirates-id.pdf"));
  await upload(page, "Passport copy", pdf("passport.pdf"));
  await upload(page, "Last 1 year's bank statements", [pdf("statements-2025.pdf"), pdf("statements-2026.pdf")]);
  await expect(page.getByText("4 of 4 ready")).toBeVisible();
  await consent(page);
  await page.getByRole("button", { name: "Get Fast Pre-Approval" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you.");
  await expect(page.getByRole("listitem").filter({ hasText: "Business trade licence" })).toContainText("1 file");
});

test("W2 refuses what the rules refuse, and says where", async ({ page }) => {
  await page.goto("/mortgages/apply?service=consultancy");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Mobile number, +971").fill("2 632 2223");
  await page.getByLabel("Date of birth").pressSequentially("31022000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Focus goes to the first field that fails.
  await expect(page.getByRole("radio", { name: "UAE National" })).toBeFocused();
  await expect(page.getByText("This looks like a landline.")).toBeVisible();
  await expect(page.getByText("Enter a real date as DD / MM / YYYY.")).toBeVisible();
  await expect(page).toHaveURL(/\/details$/);
});
