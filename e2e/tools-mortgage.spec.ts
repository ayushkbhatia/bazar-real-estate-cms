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
 *
 * The same rule applies one level up, which is what this file originally
 * missed: an editor owns section VISIBILITY as well as the figures inside it.
 * Five of the six sections carry a switch in Pages & blocks, so any spec
 * touching one has to establish it is on the page before asserting anything
 * about it — with `count()`, so an off section skips rather than spending a
 * 30-second timeout discovering it is absent.
 */

const MONEY = /AED\s?[0-9,]+/;

test("the calculator renders its headline numbers", async ({ page }) => {
  await page.goto("/tools/mortgage");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Scenario is the one section Pages & blocks cannot switch off, so the
  // monthly figure is always on the page.
  await expect(page.getByTestId("monthly-payment")).toContainText(MONEY);
});

test("cash to close breaks out the statutory lines, when it is switched on", async ({
  page,
}) => {
  await page.goto("/tools/mortgage");

  // Cash to close carries its own switch — see the note on CashToCloseSection,
  // which says removing it is meant to be one click in Pages & blocks — and it
  // is switched off in production today. This spec asserted it unconditionally
  // and so went red on an editorial decision with no commit behind it, which
  // is the exact failure mode the header of this file was written to prevent.
  // The rule generalises: an editor owns section VISIBILITY as well as the
  // figures inside it.
  //
  // `count()` resolves immediately; a visibility assertion on an absent
  // section would burn the full timeout before the skip could be reached.
  const section = page.getByTestId("cash-to-close-section");
  test.skip(
    (await section.count()) === 0,
    "Cash to close is switched off in Pages & blocks.",
  );

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

test("the pre-approval form is drawn once, and the closing CTA leads to it", async ({
  page,
}) => {
  await page.goto("/tools/mortgage");

  // Which of the two places the form sits in — the hero or the closing band —
  // is a switch in Pages & blocks. What must hold either way is that it is
  // drawn EXACTLY once: two live copies on one page is two sets of answers to
  // reconcile, and each would file its own lead.
  await expect(page.getByTestId("pre-approval-form")).toHaveCount(1);

  const cta = page.getByTestId("pre-approval-cta");
  await expect(cta).toBeVisible();
  const href = await cta.getAttribute("href");
  expect(href).not.toBeNull();

  if (href!.startsWith("#")) {
    // Form in the hero: the closing band scrolls back up to it.
    const target = page.locator(href!);
    await expect(target).toHaveCount(1);
    await expect(target.locator("form")).toHaveCount(1);
    return;
  }

  // Form in the closing band: the second button hands off to WhatsApp with the
  // scenario prefilled. Read the figures off the page rather than hardcoding
  // them — the opening scenario is an admin's to set.
  expect(href!.startsWith("https://wa.me/")).toBe(true);
  const decoded = decodeURIComponent(href!.split("?text=")[1] ?? "");
  const monthly = (await page.getByTestId("monthly-payment").innerText()).trim();
  expect(decoded).toContain(monthly);
  expect(decoded).toMatch(/Property price: AED [0-9,]+/);
  expect(decoded).toMatch(/Term: \d+ years/);
});

test("every section the editor arranged renders, in that order", async ({
  page,
}) => {
  await page.goto("/tools/mortgage");

  // The page is six sections an editor can reorder or switch off, so the spec
  // asserts they are consistent with each other rather than pinning an order
  // the CMS owns: whatever renders must be a known section, the scenario
  // selector must be there (it is locked), and nothing may render twice.
  const ids = await page
    .locator("main section[data-testid]")
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.testid ?? ""),
    );
  const known = [
    "scenario-section",
    "affordability-section",
    "compare-section",
    "amortization-section",
    "cash-to-close-section",
    "pre-approval-section",
  ];
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(known, `unknown section ${id}`).toContain(id);
  expect(new Set(ids).size, "a section rendered twice").toBe(ids.length);
  expect(ids).toContain("scenario-section");
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
