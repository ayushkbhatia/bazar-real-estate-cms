import { test, expect, devices, type Page } from "@playwright/test";

/**
 * The search results map must not download on a viewport that cannot show it.
 *
 * `search-list.tsx` renders the map column as a `hidden lg:block` aside. CSS
 * visibility does not stop React mounting, so before `LgOnly` the aside's
 * `next/dynamic` child fired its loader at every width and pulled the MapLibre
 * engine (~1.8MB raw, ~276KB transferred) down for a map a phone can never
 * see. MOBILE_AUDIT §5.7 lists it; §8 asks for exactly this spec.
 *
 * Reachable on a phone through `?view=grid` — a shared link, or the
 * ViewToggle's own Grid button — and on every tablet, because `lib/device.ts`
 * counts only `device.type === "mobile"` as a phone, so a tablet UA gets the
 * grid default. The phone default is list view, which renders no aside at all,
 * so the param is not decoration: without it this spec would pass on the
 * unfixed code by measuring a page that never had a map in it.
 *
 * Geometry/payload invariant only — no copy, no counts, no named subject. CI
 * runs against the live production CMS (see `e2e/_helpers.ts`), so the spec
 * skips when nothing is published rather than asserting a catalogue exists.
 */

/**
 * Off-plan, because off-plan is what the catalogue reliably holds —
 * `e2e/_helpers.ts` and `e2e/search-view-mobile-default.spec.ts` both pick it
 * for the same reason. `/buy/search` legitimately returns zero rows today.
 */
const SEARCH = "/off-plan/search?view=grid";

/**
 * How long a MapLibre mount is given to betray itself.
 *
 * Not a guess that only the phone test relies on: the desktop control below
 * uses the SAME constant as its timeout, so if a runner is ever slower than
 * this the desktop test goes red rather than the phone test going quietly
 * vacuous. That is the right failure direction — a broken control is louder
 * than a detector that stopped detecting.
 */
const SETTLE_MS = 3000;

/**
 * What a booting MapLibre puts on the wire.
 *
 * `maplibre|mapbox-gl` is what MOBILE_AUDIT §8 proposed, and on its own it is
 * INERT here: Next 16 builds with Turbopack, whose chunk filenames are opaque
 * hashes (`.next/static/chunks/0-26mhu_t4cls.js`), so the engine's own chunk
 * URL contains no module name to match. It is kept because
 * `/vendor/mapbox-gl-rtl-text.js` does match on `/ar`, and because a future
 * bundler that does name chunks would start matching for free.
 *
 * `cartocdn` is the half that actually fires: `map-style.ts:21` fetches
 * `basemaps.cartocdn.com/gl/positron-gl-style/style.json` from `MapView`'s
 * mount effect, then tiles/glyphs/sprites from the same host. Nothing else on
 * a search route touches it — `DrawAreaTool` and `CommuteTimeTool` are UI
 * stubs with no map (Sprint 12 was never wired).
 *
 * Note this is a request-level check, so it fires on request INITIATION and
 * is unaffected by whether CARTO actually answers.
 */
const MAP_ASSET = /maplibre|mapbox-gl|cartocdn/i;

/**
 * `MapView` returns `<div className="bzmap …">` synchronously on mount, before
 * its style fetch resolves. So `.bzmap` being in the DOM proves the dynamic
 * chunk downloaded AND evaluated — the load-bearing assertion here, because it
 * depends on nothing outside the local test server.
 *
 * `area-map.tsx` also uses the class, but it renders on `/` and `/areas`, not
 * on a search route.
 */
const MAP_ROOT = ".bzmap";

/**
 * `devices[…]` carries `defaultBrowserType`, which Playwright refuses inside a
 * `describe` (it would force a new worker) and which CI cannot honour anyway —
 * only Chromium is installed. The viewport, touch flags and user agent are
 * what matter; `search-view-mobile-default.spec.ts` strips the same field.
 *
 * The UA is load-bearing beyond the viewport: `lib/device.ts` reads it
 * server-side, and a viewport-only context would render markup no phone
 * receives.
 */
const { defaultBrowserType: _ignored, ...IPHONE } = devices["iPhone 13"];

/** Collects every map-ish request from before the first navigation. */
function watchMapRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (MAP_ASSET.test(r.url())) seen.push(r.url());
  });
  return seen;
}

/** Grid cards link to `/p/<slug>`; zero of them means nothing to assert on. */
async function skipWithoutListings(page: Page) {
  const cards = await page.locator("a[href^='/p/']").count();
  test.skip(cards === 0, "no published listings, so no results grid, no aside");
}

test.describe("phone", () => {
  test.use(IPHONE);

  test("grid view does not download the MapLibre engine", async ({ page }) => {
    const mapRequests = watchMapRequests(page);
    await page.goto(SEARCH);
    await skipWithoutListings(page);

    // Long enough that an ungated dynamic import would have landed — proven by
    // the desktop control, which mounts the map inside this same budget.
    await page.waitForTimeout(SETTLE_MS);

    expect(
      await page.locator(MAP_ROOT).count(),
      `A MapLibre map mounted at ${IPHONE.viewport?.width}px. The aside is ` +
        `\`hidden lg:block\`, so nothing here is visible — this is pure ` +
        `payload. Re-check the \`LgOnly\` wrapper in search-list.tsx: a CSS ` +
        `class cannot do this job, only a real mount gate can.`,
    ).toBe(0);

    expect(
      mapRequests,
      `Map assets were requested at ${IPHONE.viewport?.width}px:\n` +
        mapRequests.map((u) => `  • ${u}`).join("\n"),
    ).toEqual([]);
  });
});

test.describe("desktop", () => {
  // No `test.use` — the config's chromium project is already Desktop Chrome
  // (1280px), comfortably past the 64rem (1024px) `lg` breakpoint.

  /**
   * The control, and the reason the phone assertions above are not vacuous.
   *
   * Two ways this spec could pass while measuring nothing: the aside gets
   * deleted, or `.bzmap` stops being the class MapLibre mounts under. Both
   * turn `.bzmap === 0` into a tautology on the phone and both fail here.
   */
  test("still mounts the map above lg — the phone check is not vacuous", async ({
    page,
  }) => {
    const mapRequests = watchMapRequests(page);
    await page.goto(SEARCH);
    await skipWithoutListings(page);

    await expect(
      page.locator(MAP_ROOT).first(),
      `No map mounted on desktop within ${SETTLE_MS}ms. Either the gate is ` +
        `too aggressive and desktop lost its map, or ${MAP_ROOT} is no longer ` +
        `what MapLibre mounts under — in which case the phone assertion above ` +
        `is now measuring nothing and needs the same selector fix.`,
    ).toBeVisible({ timeout: SETTLE_MS });

    /*
     * Reported, not asserted — on purpose.
     *
     * The engine is proven loaded by the DOM check above, which is served
     * entirely from the local test server. This second signal depends on
     * reaching CARTO's CDN, and a gate that reddens `main` because a third
     * party is unreachable is the kind of red that teaches everyone to re-run
     * CI (same argument as the webServer timeout note in playwright.config.ts).
     *
     * So it annotates instead. An empty annotation here means the URL half of
     * the phone assertion has gone inert and only its DOM half is working —
     * worth knowing, not worth failing over.
     */
    test.info().annotations.push({
      type: "map-asset-requests",
      description:
        mapRequests.length > 0
          ? `${mapRequests.length} matched ${MAP_ASSET}`
          : `none matched ${MAP_ASSET} — the URL half of the phone check is ` +
            `inert (CDN moved, or offline runner); its DOM half still holds`,
    });
  });
});
