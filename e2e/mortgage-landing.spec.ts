import { expect, test } from "@playwright/test";

/**
 * The mortgage page's way into the application (Bazar, 9 Oct 2026): the
 * hero's panel is the wizard's first step, so choosing a service there lands
 * on "Your details" with Step 1 done; every other start on the page points at
 * the same doors. Local only, with the rest of the mortgage specs: it needs
 * the application open, which the local seed sets.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
const LOCAL = !!BASE && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE);
test.skip(!LOCAL, "Runs only against the local stack (MORTGAGE_E2E_BASE_URL=http://localhost:3107).");
const SHOTS = process.env.MORTGAGE_E2E_SHOTS;

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      name: "bz_consent",
      value: encodeURIComponent(JSON.stringify({ essential: true, analytics: false, marketing: false, decided_at: new Date().toISOString(), version: 1 })),
      url: BASE!,
    },
  ]);
});

test("choosing Fast Pre-Approval in the hero lands on Your details, Step 1 done", async ({ page }) => {
  await page.goto("/tools/mortgage");
  const panel = page.getByTestId("mortgage-start-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("start-preapproval")).toHaveAttribute("href", /service=pre_approval.*step=details/);
  await expect(panel.getByTestId("start-consultancy")).toHaveAttribute("href", /service=consultancy.*step=details/);

  await panel.getByTestId("start-preapproval").click();
  await page.waitForURL(/\/mortgages\/apply\/details$/);
  await expect(page.getByRole("heading", { level: 1, name: "Personal details" })).toBeVisible();
  // The tracker: Step 1 done, and the last step reads Documents (Fast Pre-Approval's).
  await expect(page.getByText("Documents").first()).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/landing-to-details.png` });
});

test("every start on the page points into the application", async ({ page }) => {
  await page.goto("/tools/mortgage");
  await expect(page.getByTestId("journey-cta")).toHaveAttribute("href", /\/mortgages\/apply\?service=pre_approval/);
  await expect(page.getByTestId("apply-bridge-cta")).toHaveAttribute("href", /service=pre_approval.*step=details/);
  await expect(page.getByTestId("apply-bridge-figures")).toContainText(/AED [\d,]+/);
  await expect(page.getByTestId("pre-approval-cta")).toHaveAttribute("href", /service=pre_approval.*step=details/);

  // The start bar shows once the panel has scrolled away, and steps aside over the closing band.
  const bar = page.getByTestId("mortgage-start-bar");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(bar).not.toHaveAttribute("data-shown", "true");
  await page.getByTestId("mortgage-apply-bridge").scrollIntoViewIfNeeded();
  await expect(bar).toHaveAttribute("data-shown", "true");
  await page.getByTestId("pre-approval-section").scrollIntoViewIfNeeded();
  await expect(bar).not.toHaveAttribute("data-shown", "true");
});
