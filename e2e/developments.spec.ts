import { test, expect } from "@playwright/test";

test("developments index links to the Saadiyat Lagoons detail page", async ({
  page,
}) => {
  await page.goto("/developments");
  await expect(
    page.getByRole("heading", { name: /new launches in abu dhabi/i }),
  ).toBeVisible();

  const card = page.getByRole("link", { name: /saadiyat lagoons/i }).first();
  await expect(card).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(/\/developments\/saadiyat-lagoons$/);
});

test("off-plan detail page renders hero + payment plan + units", async ({
  page,
}) => {
  await page.goto("/developments/saadiyat-lagoons");

  // Hero
  await expect(
    page.getByRole("heading", { name: /^saadiyat lagoons$/i, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/bazar exclusive/i).first()).toBeVisible();

  // Payment plan section + 7 timeline milestones
  await expect(
    page.getByRole("heading", { name: /cash flow timeline/i }),
  ).toBeVisible();
  // The percent labels appear once per milestone — 7 total milestones, with
  // four distinct percent values: 10% (x4), 20% (x3).
  await expect(page.locator("text=Booking")).toBeVisible();
  await expect(page.locator("text=Handover").first()).toBeVisible();

  // Calculator picks the first available unit and shows AED math
  await expect(page.locator("text=AED 6.2M").first()).toBeVisible();

  // Units table with all 8 seed units
  await expect(
    page.getByRole("heading", { name: /what's left/i }),
  ).toBeVisible();
  await expect(page.locator("text=Villa A").first()).toBeVisible();
  await expect(page.locator("text=Villa F").first()).toBeVisible();
  await expect(page.locator("text=Townhouse").first()).toBeVisible();

  // Status pills — Villa E + the first townhouse are seeded as 'held'.
  await expect(page.locator("text=Held").first()).toBeVisible();
});

test("unit filter narrows the table to townhouses", async ({ page }) => {
  await page.goto("/developments/saadiyat-lagoons");

  // Click the "Townhouses" filter chip; expected to show 2 rows from the seed.
  await page.getByRole("button", { name: /townhouses ·/i }).click();
  await expect(page.locator("text=Townhouse").first()).toBeVisible();
  await expect(page.locator("text=Villa A")).toHaveCount(0);
});

test("unknown development slug 404s", async ({ page }) => {
  const response = await page.goto("/developments/no-such-slug");
  expect(response?.status()).toBe(404);
});
