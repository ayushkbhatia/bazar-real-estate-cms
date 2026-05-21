import { test, expect } from "@playwright/test";

test("valuation wizard walks owner through all four steps and submits", async ({
  page,
}) => {
  await page.goto("/tools/valuation");
  await expect(
    page.getByRole("heading", { name: /What's your property worth/i }),
  ).toBeVisible();

  // Progress strip shows all four labels.
  const progress = page.getByTestId("progress-strip");
  await expect(progress).toContainText("Property");
  await expect(progress).toContainText("Specifications");
  await expect(progress).toContainText("Condition & upgrades");
  await expect(progress).toContainText("About you");

  // Live preview is visible with a default range (Saadiyat apartment defaults
  // give us a populated range immediately).
  await expect(page.getByTestId("preview-range")).toContainText(/M – /);

  // Step 1 — fill the building name then continue.
  await page.getByLabel(/Building \/ development/i).fill("Mamsha Al Saadiyat");
  await page
    .getByRole("button", { name: /Continue · Specifications/i })
    .click();

  // Step 2 — keep the defaults, advance.
  await expect(
    page.getByRole("heading", { name: /^Specifications$/i }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Continue · Condition & upgrades/i })
    .click();

  // Step 3 — keep defaults, advance.
  await expect(
    page.getByRole("heading", { name: /^Condition & upgrades$/i }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Continue · About you/i })
    .click();

  // Step 4 — fill name + email, submit.
  await expect(
    page.getByRole("heading", { name: /^About you$/i }),
  ).toBeVisible();
  const ts = Date.now();
  await page.getByLabel(/^Full name$/i).fill(`Playwright Owner ${ts}`);
  await page.getByLabel(/^Email$/i).fill(`pw+val-${ts}@example.com`);
  await page.getByRole("button", { name: /Send for review/i }).click();

  // Confirmation card + frozen instant range.
  const confirmation = page.getByTestId("valuation-confirmation");
  await expect(confirmation).toBeVisible({ timeout: 15_000 });
  await expect(confirmation).toContainText(/Your valuation is in review/i);
  await expect(page.getByTestId("confirmation-range")).toContainText(/M – /);
});

test("wizard rejects step 4 with an invalid email", async ({ page }) => {
  await page.goto("/tools/valuation");
  await page
    .getByRole("button", { name: /Continue · Specifications/i })
    .click();
  await page
    .getByRole("button", { name: /Continue · Condition & upgrades/i })
    .click();
  await page
    .getByRole("button", { name: /Continue · About you/i })
    .click();
  await page.getByLabel(/^Full name$/i).fill("Test");
  await page.getByLabel(/^Email$/i).fill("not-an-email");
  await page.getByRole("button", { name: /Send for review/i }).click();
  await expect(page.getByText(/Enter a valid email/i)).toBeVisible();
});
