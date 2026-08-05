import { test, expect } from "@playwright/test";

/**
 * /contact-us/qr is the QR scan destination, so /contact-us is a path people
 * reach by trimming the URL or typing it from memory. It was never a route —
 * the contact page is /contact — so it 404'd.
 *
 * The redirect is exact-match. The test that actually matters here is the
 * second one: if /contact-us ever became a prefix redirect it would swallow
 * /contact-us/qr, and every printed QR code would land on the contact page
 * instead of the scan landing.
 */
test("/contact-us redirects to /contact", async ({ page }) => {
  await page.goto("/contact-us");
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("/contact-us/qr is NOT swallowed by that redirect", async ({ page }) => {
  const res = await page.goto("/contact-us/qr");
  expect(res?.status()).toBe(200);
  // Still on the scan landing, not bounced to /contact.
  await expect(page).toHaveURL(/\/contact-us\/qr$/);
});

test("/qr still renders the code that points at the landing", async ({
  page,
}) => {
  const res = await page.goto("/qr");
  expect(res?.status()).toBe(200);
  // The generated QR is an inline SVG from the `qrcode` package.
  await expect(page.locator("svg[shape-rendering='crispEdges']")).toBeVisible();
});
