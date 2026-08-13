import { test, expect } from "@playwright/test";

test("/insights surfaces the newsletter signup form", async ({ page }) => {
  await page.goto("/insights");
  // The signup form, located by its own field rather than by its button copy —
  // forms.copy.submit_label is editor-owned and has changed under CI before.
  const form = page
    .locator("form")
    .filter({ has: page.getByPlaceholder(/you@email\.com/i) });
  await expect(form).toBeVisible();
  await expect(form.locator('button[type="submit"]')).toBeVisible();
});

test("rejected emails surface a client-side error", async ({ page }) => {
  await page.goto("/insights");
  await page.getByPlaceholder(/you@email\.com/i).fill("not-an-email");
  // Browser-level required validation will block submit; trigger via click.
  await page
    .locator("form")
    .filter({ has: page.getByPlaceholder(/you@email\.com/i) })
    .locator('button[type="submit"]')
    .click();
  // The native :invalid validation message is enforced by the browser —
  // form does not submit. The email field stays focused.
  await expect(page.getByPlaceholder(/you@email\.com/i)).toBeFocused();
});

test("a valid signup shows a confirmation message", async ({ page }) => {
  await page.goto("/insights");
  const ts = Date.now();
  await page
    .getByPlaceholder(/you@email\.com/i)
    .fill(`playwright+${ts}@bazar.test`);
  await page.getByRole("button", { name: /^subscribe$/i }).click();
  await expect(
    page.getByText(/(check your inbox|already subscribed)/i),
  ).toBeVisible({ timeout: 15_000 });
});

test("/newsletter/confirm/<bad-token> shows the not-found copy", async ({
  page,
}) => {
  await page.goto("/newsletter/confirm/00000000000000000000000000000000000000000000abcd");
  await expect(
    page.getByRole("heading", { name: /couldn'?t find/i }),
  ).toBeVisible();
});

test("/newsletter/unsubscribe/<bad-token> shows the already-removed copy", async ({
  page,
}) => {
  await page.goto("/newsletter/unsubscribe/00000000000000000000000000000000000000000000abcd");
  await expect(
    page.getByRole("heading", { name: /already removed/i }),
  ).toBeVisible();
});

// The /account/newsletter preference page went with the customer-account
// surface in #216. The public newsletter flow above (signup, confirm,
// unsubscribe) is what survives; e2e/dsr.spec.ts pins the 404.
