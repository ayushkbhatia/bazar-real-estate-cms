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
