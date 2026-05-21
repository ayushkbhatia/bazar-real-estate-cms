import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Axe-core accessibility scan for the same three routes Lighthouse CI checks.
 *
 * We only fail on rules we believe in shipping clean: the WCAG 2 A/AA tags
 * minus a small list of false-positives that don't apply to our markup
 * (see `disableRules`). New violations on any of these routes must be fixed
 * before merge.
 *
 * For a per-PR diff of what changed, look at the JSON in the
 * `playwright-report/` artifact uploaded on failure.
 */

const ROUTES = [
  { path: "/", label: "home" },
  { path: "/buy", label: "buy" },
  {
    path: "/p/mamsha-3-bed-beachfront-apartment-baz-ad-04891",
    label: "property detail",
  },
] as const;

// Rules we explicitly opt out of with a documented reason. Keep this list
// short — every entry is a deliberate compromise.
const DISABLED_RULES: string[] = [
  // The Tiptap editor (admin only) and shadcn Select listbox don't always
  // get a reachable name from sibling components; we'd be flagging false
  // positives on admin routes that aren't even part of these scans.
  // (No exclusions needed for public routes at the moment.)
];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

for (const route of ROUTES) {
  test(`a11y: ${route.label} (${route.path}) has no axe violations`, async ({
    page,
  }) => {
    await page.goto(route.path);

    // Dismiss the consent banner so it doesn't compete for focus during
    // scans — its own a11y is covered separately below.
    const bannerButton = page.getByRole("dialog", { name: /cookies/i }).getByRole("button", {
      name: /^reject all$/i,
    });
    if (await bannerButton.isVisible().catch(() => false)) {
      await bannerButton.click();
      await expect(
        page.getByRole("dialog", { name: /cookies/i }),
      ).toBeHidden();
    }

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(TAGS)
      .disableRules(DISABLED_RULES)
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      // Surface a concise readable summary in the report instead of a wall
      // of JSON. Each violation includes the rule id, impact, and nodes.
      console.log(
        `Axe violations on ${route.path}:`,
        JSON.stringify(
          accessibilityScanResults.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
            targets: v.nodes.flatMap((n) => n.target).slice(0, 3),
          })),
          null,
          2,
        ),
      );
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });
}

test("a11y: cookie banner itself is keyboard-accessible", async ({ page }) => {
  await page.goto("/");

  const banner = page.getByRole("dialog", { name: /cookies/i });
  await expect(banner).toBeVisible();

  // Title + body are referenced from the dialog (axe checks this rule).
  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(TAGS)
    .analyze();
  expect(results.violations).toEqual([]);
});
