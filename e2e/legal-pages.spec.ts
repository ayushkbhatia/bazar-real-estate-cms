import { test, expect } from "@playwright/test";

// All three documents are master pages now, and none of them carries the
// "lawyer-drafted copy in progress" banner — the client asked for it gone.
// Privacy routes rights requests to info@ from its CMS field; terms and
// cookies take the frame's dpo@ default.
const LEGAL_DOCS = [
  { slug: "privacy", contact: "info@bazarrealestate.ae" },
  { slug: "terms", contact: "dpo@bazarrealestate.ae" },
  { slug: "cookies", contact: "dpo@bazarrealestate.ae" },
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
    // The draft banner was removed from the frame outright — assert it stays
    // removed, on every document, rather than just deleting the assertion.
    await expect(
      page.getByText(/lawyer-drafted copy in progress/i),
    ).toHaveCount(0);
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

test("the Arabic privacy policy renders right-to-left and links both ways", async ({
  page,
}) => {
  await page.goto("/legal/privacy");
  /*
   * Scoped to the DOCUMENT's own switcher, not the page.
   *
   * There are now two links to the Arabic policy on this page and they are
   * different things: this one, inside the legal doc's nav, which exists
   * because only privacy has an Arabic edition; and the site-wide locale
   * toggle in the header chrome, whose accessible name is also "العربية".
   * An unscoped `getByRole` matches both and Playwright's strict mode fails
   * the click. This test is about the document linking both ways, so it says
   * which link it means — the toggle has its own spec.
   */
  const englishSwitcher = page.getByRole("navigation", {
    name: "Legal documents",
  });
  await englishSwitcher.getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar\/legal\/privacy$/);

  // The document — not the whole app chrome — carries lang/dir.
  const doc = page.locator('[lang="ar"][dir="rtl"]').first();
  await expect(doc).toBeVisible();
  await expect(doc.getByRole("heading", { name: /سياسة الخصوصية/ })).toBeVisible();

  // §10 is the PDPL contact route, and it must be the same mailbox the
  // English edition publishes.
  await expect(
    page.getByRole("link", { name: "info@bazarrealestate.ae" }).first(),
  ).toBeVisible();

  // The Arabic edition offers the language switch alone: the document tabs
  // would land the reader back in English without warning. (The site footer
  // still links all three English docs — that is separate.)
  const switcher = page.getByRole("navigation", { name: "لغة المستند" });
  await expect(switcher.getByRole("link")).toHaveCount(1);
  await expect(switcher.getByRole("link", { name: "English" })).toBeVisible();

  // Same ambiguity in the other direction — the header toggle also offers
  // "English" — so return through the document's switcher too.
  await switcher.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/legal\/privacy$/);
});
