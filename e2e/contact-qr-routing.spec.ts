import { test, expect } from "@playwright/test";

/**
 * The QR scan destination is /contact-qr. It was originally /contact-us/qr,
 * and the old path still redirects — a printed QR code cannot be re-issued
 * once it is on a card or an office window, so that redirect is permanent.
 *
 * /contact-us was never a page at all; it just reads like one and gets typed.
 */
test("/contact-qr serves the scan landing", async ({ page }) => {
  const res = await page.goto("/contact-qr");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/contact-qr$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("the card saves to a phone — the button downloads a parseable vCard", async ({
  page,
  request,
}) => {
  await page.goto("/contact-qr");
  const save = page.getByTestId("qr-save-contact");
  await expect(save).toBeVisible();

  // Assert against the response rather than a download event: the point is
  // that a phone gets something Contacts will open, which is the content type
  // and the body, not the browser's save dialog.
  const href = await save.getAttribute("href");
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/vcard");
  expect(res.headers()["content-disposition"]).toContain(".vcf");

  const card = await res.text();
  expect(card).toContain("BEGIN:VCARD");
  expect(card).toContain("END:VCARD");
  // The numbers on the page have to be the numbers in the file.
  const shown = await page.getByTestId("qr-mobile-link").innerText();
  expect(card).toContain(shown.split(":").pop()!.trim());
});

test("the EN/AR toggle flips the card's language and direction", async ({
  page,
}) => {
  await page.goto("/contact-qr");
  const card = page.getByTestId("qr-lang-ar").locator("xpath=ancestor::*[@dir][1]");
  await expect(card).toHaveAttribute("dir", "ltr");

  await page.getByTestId("qr-lang-ar").click();
  await expect(card).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("qr-lang-ar")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByTestId("qr-lang-en").click();
  await expect(card).toHaveAttribute("dir", "ltr");
});

test("the old /contact-us/qr still reaches it — printed codes keep working", async ({
  page,
}) => {
  await page.goto("/contact-us/qr");
  await expect(page).toHaveURL(/\/contact-qr$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("/contact-us redirects to /contact", async ({ page }) => {
  await page.goto("/contact-us");
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("/qr renders a code pointing at the new slug", async ({ page }) => {
  const res = await page.goto("/qr");
  expect(res?.status()).toBe(200);
  await expect(page.locator("svg[shape-rendering='crispEdges']")).toBeVisible();
  // The destination is shown as text under the code, so a scanner-less
  // visitor can type it — and so this test can read it.
  await expect(page.getByText("/contact-qr")).toBeVisible();
});
