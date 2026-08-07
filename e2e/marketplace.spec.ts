import { test, expect } from "@playwright/test";
import { firstPropertyPath } from "./_helpers";

test("home → /buy → property detail", async ({ page }) => {
  await page.goto("/");
  // The hero headline is CMS-owned since #222 — it has already been changed
  // once from "Find a home worth keeping." to "Your Future Has an Address".
  // Assert that a headline renders, not what it says.
  const heroHeading = page.getByRole("heading", { level: 1 }).first();
  await expect(heroHeading).toBeVisible();
  await expect(heroHeading).not.toBeEmpty();

  // Featured listings come from Supabase. If they're not present, the page
  // shows a placeholder — we tolerate that locally and only assert on the
  // CTA, then navigate to /buy/search via the featured "All properties" link
  // (search moved to /buy/search; /buy is now the marketing landing).
  await page.getByRole("link", { name: /^all properties$/i }).click();
  await expect(page).toHaveURL(/\/buy\/search/);
  await expect(
    page.getByRole("heading", { name: /properties for sale/i }),
  ).toBeVisible();

  // Click into the first listing card.
  const firstCard = page.locator("a[href^='/p/']").first();
  test.skip(
    (await firstCard.count()) === 0,
    "No listings in the for-sale search — the published catalogue is all off-plan.",
  );
  await expect(firstCard).toBeVisible();
  await firstCard.click();

  // Property detail should display the canonical reference at least once.
  await expect(page).toHaveURL(/\/p\/[a-z0-9-]+-baz-[a-z]+-\d+$/);
  await expect(page.getByText(/BAZ-[A-Z]+-\d+/).first()).toBeVisible();
});

test("invalid property reference 404s", async ({ page }) => {
  const response = await page.goto("/p/garbage");
  expect(response?.status()).toBe(404);
});

test("admin gating redirects anon to staff login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("sitemap + robots are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain("Sitemap:");
  expect(robotsText).toContain("Disallow: /admin");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("<urlset");
  expect(sitemapText).toMatch(/<loc>[^<]+\/buy<\/loc>/);
});

test("property page emits JSON-LD with the right reference", async ({ page }) => {
  const path = await firstPropertyPath(page);
  test.skip(!path, "No published properties in the marketplace.");
  await page.goto(path!);

  // The reference is the tail of the URL slug, so derive the expectation from
  // the address rather than hard-coding one — it stays meaningful when the
  // catalogue turns over, and still fails if URL, page and JSON-LD disagree.
  const reference = path!
    .match(/-(baz-[a-z]+-\d+)$/)?.[1]
    .toUpperCase();
  expect(reference).toBeTruthy();
  await expect(page.getByText(reference!).first()).toBeVisible();

  // Sprint 11: root layout now emits an organization-level RealEstateAgent
  // block alongside the page-level RealEstateListing. Iterate all blocks
  // and assert the RealEstateListing one exists with the right identifier.
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(blocks.length).toBeGreaterThan(0);
  const listing = blocks
    .map((b) => {
      try {
        return JSON.parse(b);
      } catch {
        return null;
      }
    })
    .find(
      (parsed) =>
        parsed && parsed["@type"] === "RealEstateListing",
    );
  expect(listing).toBeTruthy();
  expect(listing.identifier).toBe(reference);
});

test("contact form rejects when no email or phone is supplied", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel(/^name$/i).fill("Playwright Tester");
  await page.getByLabel(/tell us more/i).fill("Need help.");
  await page.getByRole("button", { name: /^submit$/i }).click();
  await expect(
    page.getByText(/need at least an email or a phone number/i),
  ).toBeVisible();
});

test("property-page sidebar accepts a valid enquiry", async ({ page }) => {
  const path = await firstPropertyPath(page);
  test.skip(!path, "No published properties in the marketplace.");
  await page.goto(path!);

  // Scoped to the enquiry form by its own fields. A property page carries
  // more than one form — the viewing request above it also has a name and a
  // phone — and matching on label text alone picked up whichever the page
  // happened to render first.
  const form = page.locator("form").filter({ has: page.locator("[name='message']") });
  await expect(form).toBeVisible();

  const ts = Date.now();
  await form.locator("[name='name']").fill(`Playwright ${ts}`);
  await form.locator("[name='email']").fill(`pw+${ts}@example.com`);
  await form
    .locator("[name='message']")
    .fill("Automated marketplace E2E test enquiry — please disregard.");
  await form.getByRole("button", { name: /send enquiry/i }).click();
  await expect(page.getByText(/thank you/i)).toBeVisible({ timeout: 15_000 });
});

test("filter bar narrows the result set via URL state", async ({ page }) => {
  await page.goto("/buy/search");
  // Beds filter — click "3 beds" (aria-label distinguishes from the baths button).
  await page.getByRole("button", { name: "3 beds" }).click();

  // URL should reflect the filter
  await expect(page).toHaveURL(/[?&]beds=3\b/);

  // Result count shows the active filter summary
  await expect(page.getByText(/3\+ beds/i)).toBeVisible();

  // Whether anything survives a 3-bed filter is the client's inventory, not
  // this test's business — it asserts that the filter drives URL state and
  // that clearing reverses it. Pinning a result count here is what made the
  // spec fail when the seed catalogue was replaced with four real listings.
  const cards = page.locator("a[href^='/p/']");
  if ((await cards.count()) > 0) await expect(cards.first()).toBeVisible();

  // Clear filters returns us to base state
  await page.getByRole("button", { name: /^clear 1$/i }).click();
  await expect(page).not.toHaveURL(/beds=3/);
});
