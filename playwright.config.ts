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
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
