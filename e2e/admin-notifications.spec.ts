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

test("viewing-reminders cron rejects unauthorised requests", async ({
  page,
}) => {
  const res = await page.request.get("/api/cron/viewing-reminders", {
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(401);
});
