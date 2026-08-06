import { test, expect } from "@playwright/test";

// Privacy now carries the client's final, lawyer-supplied text — no draft
// banner, and rights requests route to info@. Terms and cookies are still
// in-house drafts on the DPO mailbox.
const LEGAL_DOCS = [
  { slug: "privacy", draft: false, contact: "info@bazarrealestate.ae" },
  { slug: "terms", draft: true, contact: "dpo@bazarrealestate.ae" },
  { slug: "cookies", draft: true, contact: "dpo@bazarrealestate.ae" },
] as const;

test("/legal redirects to /legal/privacy", async ({ page }) => {
  await page.goto("/legal");
  await expect(page).toHaveURL(/\/legal\/privacy$/);
});

for (const doc of LEGAL_DOCS) {
  test(`/legal/${doc.slug} renders the doc and its sibling nav`, async ({
    page,
  }) => {
    await page.goto(`/legal/${doc.slug}`);
    await expect(
      page.getByText(/lawyer-drafted copy in progress/i),
    ).toHaveCount(doc.draft ? 1 : 0);
    // Tab nav surfaces the other two siblings
    const nav = page.getByRole("navigation", { name: /legal documents/i });
    await expect(nav.getByRole("link", { name: /privacy/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /terms/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /cookies/i })).toBeVisible();
  });
}

test("every legal page routes data-subject requests to a contact", async ({
  page,
}) => {
  // Self-service export/deletion pages went with the customer-account surface
  // in #216; requests are keyed by email now (migration 0067) and worked by
  // staff at /admin/dsr. The legal pages must still give subjects a route —
  // that is the PDPL obligation, and it is what this asserts.
  for (const doc of LEGAL_DOCS) {
    await page.goto(`/legal/${doc.slug}`);
    await expect(
      page.getByRole("link", { name: doc.contact }).first(),
      `/legal/${doc.slug} should offer the ${doc.contact} contact`,
    ).toBeVisible();
  }
});
