import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * iPhone 13 minus `defaultBrowserType`.
 *
 * The descriptor names WebKit, but CI installs Chromium only
 * (`npx playwright install --with-deps chromium`), so honouring it fails every
 * test in the project with "Executable doesn't exist". What this gate actually
 * needs from the descriptor is the phone viewport, the touch flags and — most
 * of all — the user agent, because `lib/device.ts` picks the search view
 * server-side from it.
 *
 * `e2e/search-view-mobile-default.spec.ts` strips the same field for the same
 * reason. The cost is that the gate measures mobile Chromium rather than
 * mobile Safari; every check here is a geometry or computed-style invariant,
 * none of which is engine-specific.
 */
const { defaultBrowserType: _iphoneBrowser, ...IPHONE } = devices["iPhone 13"];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /**
   * Two locally, not "however many cores you have".
   *
   * Every spec drives one `next start` process that renders uncached pages
   * against the live Supabase project, so the suite is bound by that single
   * server and one remote database — extra workers don't add throughput, they
   * queue behind each other until assertions time out. On this machine the
   * default (5) produced 17 failures against CI's 1, all of them contention:
   * clicks landing on elements that had reflowed, `toBeVisible` expiring while
   * a render sat in line. That gap is worse than slow, because it trains you
   * to ignore a red local run.
   */
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      /*
       * The geometry gate is the mobile project's job. Without this the whole
       * suite would be collected twice — and CI runs `workers: 1`, so that is
       * a straight doubling of a job that already sits inside a 20-minute cap.
       */
      testIgnore: /mobile-geometry\.spec\.ts/,
    },
    {
      /*
       * Phone viewport gate. Scoped to the geometry spec on purpose: this is a
       * net for CSS-breakpoint regressions, not a second full pass of the
       * suite.
       *
       * The device descriptor is used rather than a bare `viewport` because
       * `lib/device.ts` picks the search view server-side from the user agent —
       * a viewport-only context would render the desktop tree at a phone width
       * and the gate would assert against markup no phone ever receives.
       * See IPHONE above for why `defaultBrowserType` is stripped.
       *
       * iPhone 13 is 390px, marginally narrower than the 393px iPhone 16
       * benchmark the audit used, so it is the stricter of the two.
       */
      name: "mobile",
      use: IPHONE,
      testMatch: /mobile-geometry\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    /*
     * Reuse a running server only when you opt in explicitly.
     *
     * This was `!process.env.CI`, i.e. "always reuse locally". That reads as a
     * convenience and is actually a correctness hole: if ANYTHING answers on
     * this port, Playwright skips `npm run build && npm run start` and tests
     * whatever that process is serving — including a server from an older
     * build whose CSS chunks have since been overwritten.
     *
     * It bit this repo directly. A `next start` left over from an earlier
     * build kept answering :3100 while a newer build replaced `.next`. Its
     * HTML linked a stylesheet that no longer existed, so pages served with NO
     * Tailwind and no globals.css at all — and the mobile gate ran green
     * against them, because "no CSS" happens not to trip a geometry
     * assertion. Hours went into diagnosing a CSS-chunking bug that did not
     * exist.
     *
     * Building every run costs ~50s locally. That is the price of the suite
     * testing the code in your working tree rather than an artifact of unknown
     * age. Set PW_REUSE_SERVER=1 when you are iterating on a spec and know the
     * server is current.
     */
    reuseExistingServer: !process.env.CI && !!process.env.PW_REUSE_SERVER,
    /*
     * This budget covers a full production build AND the server coming up,
     * because the command is `build && start` rather than a dev server.
     *
     * It was 180s, which the build has now outgrown. A cold `npm run build`
     * measures 52s on a fast local machine; a GitHub runner is routinely 2-3x
     * slower, which puts the build alone at 100-150s before `next start` has
     * booted or answered a request. The result is a timeout that fires with no
     * error in the log — the failure reads as "webServer timed out" and looks
     * like a hang rather than a budget, so the natural response is to re-run
     * it, which sometimes works and teaches everyone to ignore a red E2E.
     *
     * It bit main directly: the merge commit for #390 went red on a run whose
     * only failure was this timeout, and the same commit passed on its PR.
     * A red main with no bad commit behind it is the specific thing ADR-0007
     * warns about for content-dependent gates, and it is just as corrosive
     * when the cause is a budget.
     *
     * 420s is roughly 3x the observed CI build, so it absorbs runner variance
     * and still fails in a sensible time if the server genuinely hangs.
     */
    timeout: 420_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
