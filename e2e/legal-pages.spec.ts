import { test, expect } from "@playwright/test";

test("/legal redirects to /legal/privacy", async ({ page }) => {
  await page.goto("/legal");
  await expect(page).toHaveURL(/\/legal\/privacy$/);
});

for (const slug of ["privacy", "terms", "cookies"] as const) {
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

test("each legal page links to DSR endpoints", async ({ page }) => {
  await page.goto("/legal/privacy");
  await expect(
    page.getByRole("link", { name: "/account/data-export" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "/account/data-deletion" }),
  ).toBeVisible();
});
