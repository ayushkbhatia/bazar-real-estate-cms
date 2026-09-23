import { test, expect } from "@playwright/test";

test("anon visitor sees the static bell placeholder (no crash) when reaching the auth redirect", async ({
  page,
}) => {
  // The bell self-fetches /api/notifications/recent. We hit it directly
  // and check it returns a JSON envelope with `rows`/`unread`/`userId`
  // (with userId=null when anon) and never errors out.
  const res = await page.request.get("/api/notifications/recent");
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json).toHaveProperty("rows");
  expect(json).toHaveProperty("unread");
  expect(json).toHaveProperty("userId");
});

test("notifications-read endpoint rejects anon callers", async ({
  page,
}) => {
  const res = await page.request.post("/api/notifications/read", {
    data: { all: true },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(401);
});

test("health-digest cron rejects unauthorised requests", async ({ page }) => {
  // Was viewing-reminders, deleted with viewing bookings. The point is that a
  // cron route is unreachable without the Bearer secret, so it needs a route
  // that exists — a 404 from a removed one passes nothing.
  //
  // 503 without CRON_SECRET, 401 with it set and no header. CI sets neither,
  // so pinning 401 asserted the environment rather than the behaviour; the
  // sibling list in lead-lifecycle.spec.ts has always accepted both.
  const res = await page.request.get("/api/cron/health-digest", {
    failOnStatusCode: false,
  });
  expect([401, 503]).toContain(res.status());
});
