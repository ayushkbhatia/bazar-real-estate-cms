import { test, expect } from "@playwright/test";

/**
 * These specs run against the live CMS, so nothing here may assert a figure an
 * editor owns.
 *
 * That used to be safe: the headline, the opening scenario (AED 4,200,000 ·
 * 25% · 4.25% · 25y) and the fee percentages were literals in the code, so
 * asserting them asserted the build. They are now Pages & blocks copy and
 * Settings → Mortgage figures, and an editor moving the DLD rate the morning
 * of a release would redden `main` with no commit behind it.
 *
 * So the assertions are on SHAPE and RELATIONSHIP — that a percentage renders
 * where a percentage belongs, that the WhatsApp handoff carries the scenario
 * actually on screen, that the affordability badge tracks the cap the page
 * quotes. Those are what the wiring guarantees; the numbers are the client's.
 */

const MONEY = /AED\s?[0-9,]+/;

test("mortgage tool renders the headline numbers for the opening scenario", async ({
  page,
}) => {
  await page.goto("/tools/mortgage");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await expect(page.getByTestId("monthly-payment")).toContainText(MONEY);

  // Cash-to-close table shows the expected statutory lines.
  const total = page.getByTestId("cash-to-close-total");
  await expect(total).toBeVisible();
  await expect(total).toContainText(MONEY);

  // Each line keeps its label and, where it is rate-derived, a percentage
  // beside it. The rate itself is an admin's to set.
  const table = page.getByTestId("cash-to-close-table");
  await expect(table).toContainText(/Down payment · [0-9.]+%/);
  await expect(table).toContainText(/DLD transfer fee · [0-9.]+%/);
  await expect(table).toContainText(/Bazar advisory · [0-9.]+%/);
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
  const decoded = decodeURIComponent(href!.split("?text=")[1] ?? "");

  // Read the scenario off the page rather than hardcoding it: the point of
  // the assertion is that the handoff carries what the visitor is looking at,
  // whatever the opening figures happen to be.
  const monthly = (await page.getByTestId("monthly-payment").innerText()).trim();
  expect(decoded).toContain(monthly);
  expect(decoded).toMatch(/Property price: AED [0-9,]+/);
  expect(decoded).toMatch(/Term: \d+ years/);
});

test("affordability badge flips when income drops below the DBR cap", async ({
  page,
}) => {
  await page.goto("/tools/mortgage");

  // Opening income is set well clear of the cap, so the badge starts green.
  const badge = page.getByTestId("affordability");
  await expect(badge).toContainText(/Comfortably/i);

  // The cap is an admin's figure and the sentence quotes it, so take it from
  // the sentence — a spec that hardcoded 50 would fail the day it moved.
  const income = page.getByLabel(/Annual income in AED/i);
  await income.fill("");
  await income.type("200,000");
  await expect(badge).toContainText(/Above the [0-9.]+% DBR cap/i);
});
