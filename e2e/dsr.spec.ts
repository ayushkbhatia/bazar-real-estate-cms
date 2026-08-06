import { test, expect } from "@playwright/test";

/**
 * The customer-account surface was removed in #216, and with it the
 * self-service DSR pages at /account/data-export and /account/data-deletion.
 * Data-subject requests are now keyed by email (migration 0067) and fulfilled
 * by staff at /admin/dsr.
 *
 * These specs previously asserted that /account/* redirected anonymous users
 * to /sign-in. That assertion was stale twice over: the account routes were
 * deleted, and so was /sign-in (next.config.ts now 301s it to /admin/login).
 */

/** Every path the deleted customer-account surface used to serve. */
const REMOVED_ACCOUNT_PATHS = [
  "/account",
  "/account/alerts",
  "/account/documents",
  "/account/enquiries",
  "/account/newsletter",
  "/account/profile",
  "/account/saved",
  "/account/data-export",
  "/account/data-deletion",
];

test("the removed customer-account surface is gone, not merely hidden", async ({
  page,
}) => {
  // A 404 is the intended outcome, and it is worth pinning: the failure mode
  // this guards against is someone re-adding an app/(account)/ page, which
  // would render ungated — proxy.ts deliberately no longer gates /account,
  // because there is nothing there to gate.
  for (const path of REMOVED_ACCOUNT_PATHS) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} should 404`).toBe(404);
  }
});

test("/data-deleted renders the deletion success page", async ({ page }) => {
  await page.goto("/data-deleted");
  await expect(
    page.getByRole("heading", { name: /your account has been deleted/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /back to the marketplace/i }),
  ).toBeVisible();
});

test("/data-deleted?reason=expired surfaces the failure copy", async ({
  page,
}) => {
  await page.goto("/data-deleted?reason=expired");
  await expect(
    page.getByRole("heading", { name: /couldn'?t complete the deletion/i }),
  ).toBeVisible();
  await expect(page.getByText(/expired/i)).toBeVisible();
});

test("legal/privacy gives data subjects a working way to exercise their rights", async ({
  page,
}) => {
  await page.goto("/legal/privacy");
  // PDPL requires a route to access/rectification/erasure. It is a mailbox
  // now, not a self-service page — the client's final text names info@ (§10)
  // — but it must be present and clickable, which is the part that actually
  // matters for compliance.
  await expect(
    page.getByRole("link", { name: "info@bazarrealestate.ae" }).first(),
  ).toBeVisible();
  // And it must not advertise the dead self-service routes.
  await expect(page.getByText("/account/data-export")).toHaveCount(0);
  await expect(page.getByText("/account/data-deletion")).toHaveCount(0);
});
