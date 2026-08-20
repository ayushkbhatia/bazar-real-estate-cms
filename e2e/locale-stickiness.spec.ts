import { test, expect } from "@playwright/test";

/**
 * A language choice has to outlive the click that made it.
 *
 * The locale lives in the URL — `/buy` is English, `/ar/buy` is not — and
 * every internal href in this repo was written unprefixed, back when one
 * locale was served. So switching to Arabic used to last exactly one page:
 * the chrome flipped, and the visitor's next click put them back in English.
 * Measured on `/ar/buy` at the time: 46 of the page's 56 internal links
 * pointed home to English.
 *
 * Two mechanisms fix it and this spec covers both, because either one alone
 * leaves a hole:
 *
 *   1. `components/i18n/link.tsx` prefixes every `<Link>` href, so ordinary
 *      navigation never leaves Arabic in the first place. Unit-tested at the
 *      function level (`lib/i18n/routing.test.ts`), but only a real page can
 *      show it applied to the chrome a visitor actually clicks.
 *   2. `proxy.ts` redirects an unprefixed URL to the visitor's chosen locale,
 *      which catches everything a `<Link>` swap cannot — a plain `<a>`, a
 *      `router.push`, a `redirect()` out of a Server Action, a bookmark, a
 *      link someone was sent.
 *
 * The third assertion is the one that would be easy to leave out and
 * expensive to miss: getting *back* to English. A sticky preference with no
 * escape is worse than no stickiness at all, because clearing cookies is the
 * only way out and nobody guesses that.
 *
 * Skips when Arabic is not served, so this spec can sit in the suite through
 * a `LOCALES` rollback without turning CI red for a deliberate decision.
 */

/** The header's Arabic option. Labelled in Arabic — that is the point of it. */
const AR_SWITCH = "a[hreflang='ar']";
const EN_SWITCH = "a[hreflang='en']";

test.describe("locale stickiness", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/buy");
    const hasArabic = await page.locator(AR_SWITCH).first().isVisible();
    test.skip(!hasArabic, "Arabic is not in LOCALES — nothing to switch to.");
  });

  test("switching to Arabic keeps the page you were reading", async ({
    page,
  }) => {
    await page.locator(AR_SWITCH).first().click();
    await page.waitForURL("**/ar/buy");

    // The switch is a full document load, deliberately: `<html dir>`, the font
    // stack and the message catalogue all live in the root layout, and a
    // client-side transition re-executes none of them.
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // `?setlang=` did its work and got out of the way. Left in the URL it
    // would be shared, canonicalised and reported in analytics.
    expect(new URL(page.url()).search).toBe("");
  });

  test("the chrome links into Arabic, not back into English", async ({
    page,
  }) => {
    await page.goto("/ar/buy");

    const strays = await page.locator("header a[href^='/']").evaluateAll(
      (links) =>
        links
          .map((a) => a.getAttribute("href") ?? "")
          // The English half of the language switch is *supposed* to leave
          // Arabic; it is the escape hatch, not a leak.
          .filter((href) => !href.includes("setlang=en"))
          .filter((href) => !href.startsWith("/ar")),
    );

    expect(strays, "header links that drop the visitor back into English").toEqual([]);
  });

  test("an unprefixed URL follows the choice", async ({ page }) => {
    await page.locator(AR_SWITCH).first().click();
    await page.waitForURL("**/ar/buy");

    // Stands in for everything the <Link> swap cannot reach: a typed URL, a
    // bookmark, a shared link, a redirect out of a Server Action.
    await page.goto("/insights");
    expect(new URL(page.url()).pathname).toBe("/ar/insights");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });

  test("English is reachable again, and stays", async ({ page }) => {
    await page.locator(AR_SWITCH).first().click();
    await page.waitForURL("**/ar/buy");

    await page.locator(EN_SWITCH).first().click();
    await page.waitForURL((url) => url.pathname === "/buy");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // The half that matters: without an explicit English choice the proxy
    // would bounce this straight back to /ar/insights and the switch would be
    // a dead control.
    await page.goto("/insights");
    expect(new URL(page.url()).pathname).toBe("/insights");
  });

  test("a visitor who never chose sees exactly what they saw before", async ({
    browser,
  }) => {
    // No cookie means no redirect, ever. This is what keeps the change inert
    // for crawlers — and `/ar` out of the index, which `robots.ts` intends.
    const context = await browser.newContext();
    const fresh = await context.newPage();
    await fresh.goto("/buy");
    expect(new URL(fresh.url()).pathname).toBe("/buy");
    await expect(fresh.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });
});
