import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

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
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
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
