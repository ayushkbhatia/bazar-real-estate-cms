import { test, expect, type Page } from "@playwright/test";

/**
 * These specs run against the live CMS, so they must not name a project.
 *
 * They used to hard-code `saadiyat-lagoons`, and all three failed the moment an
 * editor unpublished it — a red build caused by a content decision, with no
 * commit behind it and nothing wrong with the code. Each spec now discovers a
 * project from the index and asserts on the shape of the page instead. A spec
 * whose data no longer exists anywhere skips with a reason rather than failing.
 */
async function firstProjectSlug(page: Page): Promise<string | null> {
  await page.goto("/developments");
  const card = page.locator('a[href^="/developments/"]').first();
  if ((await card.count()) === 0) return null;
  const href = await card.getAttribute("href");
  return href?.replace("/developments/", "") ?? null;
}

/** Walk the index looking for a project whose page satisfies `predicate`. */
async function findProjectWhere(
  page: Page,
  predicate: (page: Page) => Promise<boolean>,
  limit = 8,
): Promise<string | null> {
  await page.goto("/developments");
  const hrefs = await page
    .locator('a[href^="/developments/"]')
    .evaluateAll((links) =>
      Array.from(
        new Set(
          links
            .map((l) => l.getAttribute("href") ?? "")
            .filter((h) => /^\/developments\/[^/]+$/.test(h)),
        ),
      ),
    );
  for (const href of hrefs.slice(0, limit)) {
    await page.goto(href);
    if (await predicate(page)) return href.replace("/developments/", "");
  }
  return null;
}

test("developments index links through to a project detail page", async ({
  page,
}) => {
  const slug = await firstProjectSlug(page);
  test.skip(!slug, "No published developments in the CMS.");

  await page.goto("/developments");
  // /developments renders the off-plan master page's copy, which is editable
  // in the CMS — assert a headline exists, not its wording.
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  await page.locator(`a[href="/developments/${slug}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/developments/${slug}$`));
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("a project page with a payment plan renders the cash-flow timeline", async ({
  page,
}) => {
  const slug = await findProjectWhere(page, async (p) =>
    p.locator("#payment-plan").count().then((n) => n > 0),
  );
  test.skip(!slug, "No published project has a payment plan configured.");

  await page.goto(`/developments/${slug}`);
  const section = page.locator("#payment-plan");

  // Header — the heading is editor-overridable, so assert the eyebrow's
  // fixed prefix rather than the H2's wording.
  await expect(section.getByText(/^Payment plan · /)).toBeVisible();
  await expect(
    section.getByRole("heading", { level: 2 }),
  ).toBeVisible();

  // The schedule renders one row per milestone, in one of the two layouts.
  // Whichever is hidden at this viewport contributes no visible rows.
  const rows = section.locator("ol > li:visible");
  expect(await rows.count()).toBeGreaterThan(0);
  // Every visible row carries a percentage.
  await expect(rows.first()).toContainText(/\d+%/);

  // The calculator's unit picker, and the PDF button that prices off it.
  await expect(
    section.getByRole("combobox", { name: /pick a unit type to price/i }),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: /custom plan as pdf/i }),
  ).toBeVisible();

  // The sub-nav offers the anchor only when the section actually rendered.
  await expect(page.locator('a[href="#payment-plan"]')).toBeVisible();
});

test("the payment-plan section survives a narrow viewport", async ({
  page,
}) => {
  const slug = await findProjectWhere(page, async (p) =>
    p.locator("#payment-plan").count().then((n) => n > 0),
  );
  test.skip(!slug, "No published project has a payment plan configured.");

  // The handoff is explicit that the horizontal timeline must flip to the
  // vertical treatment rather than compress. Below `xl` exactly one layout
  // may be visible, and the section must not push the page sideways.
  await page.setViewportSize({ width: 393, height: 900 });
  await page.goto(`/developments/${slug}`);

  const section = page.locator("#payment-plan");
  await expect(section.locator("ol:visible")).toHaveCount(1);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflows).toBe(false);
});

test("unit filter narrows the table", async ({ page }) => {
  const slug = await findProjectWhere(page, async (p) =>
    p
      .getByRole("button", { name: /townhouses ·/i })
      .count()
      .then((n) => n > 0),
  );
  test.skip(!slug, "No published project has unit inventory loaded.");

  await page.goto(`/developments/${slug}`);
  await page.getByRole("button", { name: /townhouses ·/i }).click();
  const table = page.locator("table");
  await expect(
    table.getByRole("cell", { name: /^Townhouse/ }).first(),
  ).toBeVisible();
  // Villa rows leave the table (the calculator's <select> may still hold an
  // option for one, so scope the assertion to the table).
  await expect(table.getByRole("cell", { name: /^Villa A$/ })).toHaveCount(0);
});

test("unknown development slug 404s", async ({ page }) => {
  const response = await page.goto("/developments/no-such-slug");
  expect(response?.status()).toBe(404);
});
