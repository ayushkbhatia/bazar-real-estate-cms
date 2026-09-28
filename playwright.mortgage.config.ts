import { defineConfig, devices } from "@playwright/test";

/**
 * The mortgage application flow's end-to-end specs, against a stack that is
 * NOT production (docs/mortgage/IMPLEMENTATION.md §1.14).
 *
 * The main config builds and serves the app against the production database,
 * where a spec must never submit an application or send an email. So these
 * specs skip unless `MORTGAGE_E2E_BASE_URL` names a server to test, and this
 * config starts nothing itself. Locally:
 *
 *   npm run db:local:reset            # the local Supabase stack
 *   (dev server on :3107 against it — the `bazar-dev-local-db` launch config)
 *   MORTGAGE_E2E_BASE_URL=http://localhost:3107 npx playwright test -c playwright.mortgage.config.ts
 *
 * The flag must be `public` (or `staff`, signed in) on that stack.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /mortgage-.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 90_000,
  use: {
    baseURL: process.env.MORTGAGE_E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
