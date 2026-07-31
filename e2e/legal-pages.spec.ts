import { test, expect } from "@playwright/test";

const LEGAL_SLUGS = ["privacy", "terms", "cookies"] as const;

test("/legal redirects to /legal/privacy", async ({ page }) => {
  await page.goto("/legal");
  await expect(page).toHaveURL(/\/legal\/privacy$/);
});

for (const slug of LEGAL_SLUGS) {
  test(`/legal/${slug} renders the doc with the in-progress banner`, async ({
    page,
  }) => {
    await page.goto(`/legal/${slug}`);
    await expect(
      page.getByText(/lawyer-drafted copy in progress/i),
    ).toBeVisible();
    // Tab nav surfaces the other two siblings
    const nav = page.getByRole("navigation", { name: /legal documents/i });
    await expect(nav.getByRole("link", { name: /privacy/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /terms/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /cookies/i })).toBeVisible();
  });
}

test("every legal page routes data-subject requests to the DPO", async ({
  page,
}) => {
  // Self-service export/deletion pages went with the customer-account surface
  // in #216; requests are keyed by email now (migration 0067) and worked by
  // staff at /admin/dsr. The legal pages must still give subjects a route —
  // that is the PDPL obligation, and it is what this asserts.
  for (const slug of LEGAL_SLUGS) {
    await page.goto(`/legal/${slug}`);
    await expect(
      page.getByRole("link", { name: "dpo@bazarrealestate.ae" }).first(),
      `/legal/${slug} should offer the DPO contact`,
    ).toBeVisible();
  }
});
