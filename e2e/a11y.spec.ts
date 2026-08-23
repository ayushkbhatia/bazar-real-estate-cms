import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { firstPropertyPath } from "./_helpers";

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

// Fixed public routes — these exist regardless of what the catalogue holds.
// The property detail scan is separate, below, because naming a listing here
// meant the scan quietly moved to a 404 page the day that listing was archived.
const ROUTES = [
  { path: "/", label: "home" },
  { path: "/buy", label: "buy landing" },
  { path: "/buy/search", label: "buy search" },
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

/**
 * Dismiss the consent banner before any axe run.
 *
 * Not only about focus. The banner is a fixed overlay, so every element it
 * covers loses its computed background — axe reports those nodes as
 * `color-contrast` *incomplete*, `messageKey: "bgOverlap"` /
 * `"elmPartiallyObscuring"` with `contrastRatio: 0`, which means "could not
 * determine", not "fails". The unresolved-contrast test below asserts on
 * `incomplete`, so an open banner reads there as a contrast failure. It went
 * red on the landing page over the nav's own CTA and the banner's own body
 * text, neither of which has a contrast problem.
 *
 * Two defects, both of which had to go:
 *
 * 1. `isVisible()` does not retry. The banner is a client component gated on
 *    `hydrated` (app/_consent/consent-provider.tsx), so it mounts after load
 *    and the check answered "false" before it existed — then the scan ran a
 *    moment later with the overlay up. The guard swallowed that as "no banner
 *    here", so the dismissal had been silently no-oping. `waitFor` retries;
 *    only a real timeout now counts as absent.
 * 2. The unresolved-contrast test did its own `goto` and never called this at
 *    all. Hence the extraction — the test that needs the dismissal most was
 *    the one route that skipped it.
 */
async function dismissConsent(page: Page) {
  const banner = page.getByRole("dialog", { name: /cookies/i });
  const appeared = await banner
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;
  await banner.getByRole("button", { name: /^reject all$/i }).click();
  await expect(banner).toBeHidden();
}

async function scan(page: Page, path: string) {
  await page.goto(path);
  await dismissConsent(page);

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules(DISABLED_RULES)
    .analyze();

  if (accessibilityScanResults.violations.length > 0) {
    // Surface a concise readable summary in the report instead of a wall
    // of JSON. Each violation includes the rule id, impact, and nodes.
    console.log(
      `Axe violations on ${path}:`,
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
}

for (const route of ROUTES) {
  test(`a11y: ${route.label} (${route.path}) has no axe violations`, async ({
    page,
  }) => {
    await scan(page, route.path);
  });
}

test("a11y: property detail has no axe violations", async ({ page }) => {
  // Whichever listing is published right now. A scan pointed at an archived
  // slug passes cleanly against the 404 page and tells you nothing.
  const path = await firstPropertyPath(page);
  test.skip(!path, "No published properties to scan.");
  await scan(page, path!);
});

/**
 * Landing pages, discovered rather than named.
 *
 * Two scans, and the second is the point. Everywhere else this suite asserts
 * only on axe `violations`; here it additionally asserts that `incomplete` is
 * empty for `color-contrast`, scoped to /lp/ alone.
 *
 * Why only here: axe reports text sitting on an image or a scrim as
 * *incomplete*, not as a violation — "Element has a 1:1 contrast ratio with the
 * background" — which is the hole e2e/hero-media-contrast.spec.ts:14 exists to
 * plug elsewhere. On a landing page every colour choice is a closed `select`
 * paired with type colours that pass against it, so an `incomplete` here really
 * does mean something went wrong rather than "axe couldn't tell". Asserting it
 * globally would light up routes where the ambiguity is genuine.
 *
 * That reasoning holds for the landing page's own sections and NOT for the
 * chrome wrapped around them, which is why the contrast pass is scoped to
 * `main`. The sticky header's CTA resolves to `bgOverlap` — axe declining to
 * compute a background under a `position: sticky` ancestor — on this route and
 * on every other one. The difference is that only this test asserts on
 * `incomplete`, so the chrome's standing ambiguity surfaced here alone, as a
 * contrast failure on a navy-on-cream button that has no contrast problem.
 *
 * The chrome is not unscanned: `ROUTES` above covers the same header and
 * footer on three routes, asserting `violations` as everywhere else. What is
 * scoped away here is an ambiguity this assertion was never written to judge.
 *
 * It stayed hidden until 21 Aug 2026. `landingPaths` reads the sitemap, all
 * three landing pages were drafts, and both tests skipped — so the assertion
 * had never run against a real page. The client published one at 18:53 UTC
 * and main went red on the next merge, with no commit behind it.
 */
async function landingPaths(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
): Promise<string[]> {
  const response = await request.get(`${baseURL}/sitemap.xml`);
  if (!response.ok()) return [];
  const xml = await response.text();
  return [...xml.matchAll(/<loc>[^<]*?(\/lp\/[a-z0-9-]+)<\/loc>/g)].map((m) => m[1]);
}

test("a11y: landing page has no axe violations", async ({ page, request, baseURL }) => {
  const paths = await landingPaths(request, baseURL ?? "");
  test.skip(paths.length === 0, "No landing pages published to scan.");
  await scan(page, paths[0]);
});

test("a11y: landing page has no unresolved contrast", async ({
  page,
  request,
  baseURL,
}) => {
  const paths = await landingPaths(request, baseURL ?? "");
  test.skip(paths.length === 0, "No landing pages published to scan.");
  await page.goto(paths[0]);
  // Still dismissed even though the banner sits outside `main`: it is a fixed
  // overlay that covers the sections being scanned, so leaving it up makes
  // them unresolvable too.
  await dismissConsent(page);
  const results = await new AxeBuilder({ page })
    .include("main")
    .withTags(TAGS)
    .disableRules(DISABLED_RULES)
    .analyze();
  const unresolved = results.incomplete.filter((r) => r.id === "color-contrast");
  if (unresolved.length > 0) {
    console.log(
      `Unresolved contrast on ${paths[0]}:`,
      JSON.stringify(
        unresolved.flatMap((r) => r.nodes.flatMap((n) => n.target)).slice(0, 6),
        null,
        2,
      ),
    );
  }
  expect(unresolved).toEqual([]);
});

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
