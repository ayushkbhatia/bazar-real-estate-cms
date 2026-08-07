import type { Page } from "@playwright/test";

/**
 * Subject discovery for specs that run against the live CMS.
 *
 * Nothing public is a fixture. Properties, developments and articles are all
 * editor-owned, and naming one in a spec makes the build fail the moment
 * someone unpublishes it — a red CI with no commit behind it. These helpers
 * find a subject the way the site itself publishes one, so a spec asserts on
 * behaviour and skips (with a reason) when there is genuinely nothing to
 * assert on.
 *
 * Not the sitemap, and not one search page:
 *
 * - `/sitemap.xml` is generated at build time. Against the production build
 *   the e2e job serves, it is a snapshot — it listed 66 properties while the
 *   database held 4, so discovery kept picking URLs that 404.
 * - Any one search page is scoped to a single `mode`. Everything published
 *   right now is off-plan, so `/buy/search` legitimately returns nothing, and
 *   sourcing from it alone would skip every property spec while the catalogue
 *   is perfectly healthy.
 *
 * So: read the rendered listing pages, in order, and take the first that
 * offers anything. Each is rendered per request, so all of them reflect the
 * catalogue as it is rather than as it was at build time.
 *
 * Underscore-prefixed so Playwright's default testMatch doesn't collect this
 * file as a spec.
 */
const LISTING_PAGES = ["/buy", "/off-plan/search", "/buy/search", "/"];

/** Detail-page paths for published properties, as the site links to them. */
export async function propertyPaths(page: Page, limit = 4): Promise<string[]> {
  for (const listing of LISTING_PAGES) {
    await page.goto(listing);
    const paths = await page
      .locator("a[href^='/p/']")
      .evaluateAll((links) =>
        Array.from(
          new Set(
            links
              .map((l) => l.getAttribute("href") ?? "")
              .filter((h) => /^\/p\/[^/?#]+$/.test(h)),
          ),
        ),
      );
    if (paths.length > 0) return paths.slice(0, limit);
  }
  return [];
}

/** A single published property, or null when nothing is published. */
export async function firstPropertyPath(page: Page): Promise<string | null> {
  const paths = await propertyPaths(page, 1);
  return paths[0] ?? null;
}
