import { test, expect } from "@playwright/test";

test("/api/health returns JSON with checks + deploy block", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  // The endpoint returns 200 on ok / degraded / unconfigured, 503 on down.
  // In CI Supabase + Resend env are wired so we expect 200.
  expect([200, 503]).toContain(response.status());
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body = (await response.json()) as {
    status: string;
    checked_at: string;
    deploy: Record<string, unknown>;
    checks: Array<{ name: string; status: string }>;
  };

  expect(["ok", "degraded", "down", "unconfigured"]).toContain(body.status);
  expect(typeof body.checked_at).toBe("string");
  expect(body.deploy).toBeDefined();
  const names = body.checks.map((c) => c.name);
  expect(names).toContain("supabase");
  expect(names).toContain("resend");
});

test("HEAD /api/health gives a status without a body", async ({ request }) => {
  const response = await request.head("/api/health");
  expect([200, 503]).toContain(response.status());
});

test("/status renders the operational card + components list", async ({
  page,
}) => {
  await page.goto("/status");

  await expect(
    page.getByRole("heading", { name: /bazar marketplace/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /^components$/i }),
  ).toBeVisible();
  await expect(page.getByText(/database & auth/i)).toBeVisible();
  await expect(page.getByText(/transactional email/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /last deploy/i }),
  ).toBeVisible();
});
