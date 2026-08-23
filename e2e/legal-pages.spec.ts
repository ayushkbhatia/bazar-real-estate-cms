import { test, expect } from "@playwright/test";

// All three documents are master pages now, and none of them carries the
// "lawyer-drafted copy in progress" banner — the client asked for it gone.
//
// The mailbox each one routes to is deliberately NOT listed here. It is a CMS
// field (`contact_email` on the doc section, with `dpo@bazarrealestate.ae` as
// the frame's code default), so the client can repoint it from
// /admin/pages without touching the repo — and did, moving all three to info@
// on 23 Aug 2026. This suite ran against the live CMS and went red on a
// content edit that was correct, with no commit behind it to point at.
//
// So the slug list is the fixture and the address is asserted by shape. What
// PDPL actually obliges is a reachable route for data-subject requests; which
// mailbox staff answer it from is theirs to choose.
const LEGAL_DOCS = ["privacy", "terms", "cookies"] as const;

test("/legal redirects to /legal/privacy", async ({ page }) => {
  await page.goto("/legal");
  await expect(page).toHaveURL(/\/legal\/privacy$/);
});

for (const slug of LEGAL_DOCS) {
  test(`/legal/${slug} renders the doc and its sibling nav`, async ({
    page,
  }) => {
    await page.goto(`/legal/${slug}`);
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
  for (const slug of LEGAL_DOCS) {
    await page.goto(`/legal/${slug}`);
    // Scoped to the frame's own rights paragraph, not to the first mailto on
    // the page — the footer and the floating CTA both publish one, and either
    // would satisfy a document-wide check while the legal contact was missing.
    // That sentence lives in `legal/_layout.tsx`, so it is code and stable.
    const rights = page
      .locator("p", { hasText: /PDPL data-subject requests/i })
      .first();
    const contact = rights.getByRole("link").first();
    await expect(
      contact,
      `/legal/${slug} should offer a data-subject contact`,
    ).toBeVisible();
    // Any mailbox, but a real one: an empty `contact_email` publishes a bare
    // `mailto:` that passes a presence check and leaves the subject nowhere
    // to write.
    await expect(
      contact,
      `/legal/${slug} contact link should carry an address`,
    ).toHaveAttribute("href", /^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
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
