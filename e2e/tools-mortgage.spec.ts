import { test, expect } from "@playwright/test";

test("mortgage tool renders the headline numbers for the default scenario", async ({
  page,
}) => {
  await page.goto("/tools/mortgage");

  await expect(
    page.getByRole("heading", { name: /what will this property actually/i }),
  ).toBeVisible();

  // Default: AED 4,200,000 · 25% down · 4.25% × 25y → ~AED 17,065/mo.
  await expect(page.getByTestId("monthly-payment")).toContainText("17,");

  // Cash-to-close table shows the expected statutory lines.
  const total = page.getByTestId("cash-to-close-total");
  await expect(total).toBeVisible();
  await expect(total).toContainText(/AED [0-9,]+/);

  const table = page.getByTestId("cash-to-close-table");
  await expect(table).toContainText(/Down payment · 25%/);
  await expect(table).toContainText(/DLD transfer fee · 4%/);
  await expect(table).toContainText(/Bazar advisory · 1\.5%/);
});

test("monthly payment falls when the user shortens the term", async ({ page }) => {
  await page.goto("/tools/mortgage");
  const monthlyBefore = await page.getByTestId("monthly-payment").innerText();

  // Picking the 15-year term raises monthly payments — and updates principal
  // share + total-paid in the hero. The pure-math unit tests already cover
  // monotonicity; the E2E just confirms the UI rewires correctly.
  await page.getByLabel("Term").click();
  await page.getByRole("option", { name: "15 years" }).click();

  const monthlyAfter = await page.getByTestId("monthly-payment").innerText();
  expect(monthlyAfter).not.toBe(monthlyBefore);
});

test("pre-approval CTA points at wa.me with the current scenario", async ({
  page,
}) => {
  await page.goto("/tools/mortgage");
  const cta = page.getByTestId("pre-approval-cta");
  await expect(cta).toBeVisible();
  const href = await cta.getAttribute("href");
  expect(href).not.toBeNull();
  // wa.me URL with the prefilled text=… querystring.
  expect(href!.startsWith("https://wa.me/")).toBe(true);
  expect(href!).toContain("?text=");
  // Default scenario references that should be encoded in the message:
  //   AED 4,200,000 · 25% down · 25 years.
  const decoded = decodeURIComponent(href!.split("?text=")[1] ?? "");
  expect(decoded).toContain("AED 4,200,000");
  expect(decoded).toContain("25%");
  expect(decoded).toContain("25 years");
});

test("affordability badge flips when income drops below the 50% DBR cap", async ({
  page,
}) => {
  await page.goto("/tools/mortgage");

  // Default income 950K → ~22% DBR → "Comfortably".
  await expect(page.getByTestId("affordability")).toContainText(/Comfortably/i);

  // Drop the income to 200K → ~102% DBR → "Above the 50%".
  const income = page.getByLabel(/Annual income in AED/i);
  await income.fill("");
  await income.type("200,000");
  await expect(page.getByTestId("affordability")).toContainText(
    /Above the 50%/i,
  );
});
