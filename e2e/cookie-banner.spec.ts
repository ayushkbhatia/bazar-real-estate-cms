import { test, expect } from "@playwright/test";

test.describe("cookie banner", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders on first visit and disappears after Accept all", async ({
    page,
    context,
  }) => {
    await page.goto("/");

    const banner = page.getByRole("dialog", { name: /cookies/i });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("heading", { name: /cookies/i })).toBeVisible();

    await banner.getByRole("button", { name: /^accept all$/i }).click();

    await expect(banner).toBeHidden();

    const cookies = await context.cookies();
    const consent = cookies.find((c) => c.name === "bz_consent");
    expect(consent).toBeDefined();
    const parsed = JSON.parse(decodeURIComponent(consent!.value));
    expect(parsed.analytics).toBe(true);
    expect(parsed.marketing).toBe(true);
    expect(parsed.decided_at).not.toBeNull();
  });

  test("Reject all persists analytics=false in the cookie", async ({
    page,
    context,
  }) => {
    await page.goto("/");

    const banner = page.getByRole("dialog", { name: /cookies/i });
    await banner.getByRole("button", { name: /^reject all$/i }).click();

    await expect(banner).toBeHidden();

    const cookies = await context.cookies();
    const consent = cookies.find((c) => c.name === "bz_consent");
    expect(consent).toBeDefined();
    const parsed = JSON.parse(decodeURIComponent(consent!.value));
    expect(parsed.analytics).toBe(false);
    expect(parsed.marketing).toBe(false);
    expect(parsed.decided_at).not.toBeNull();
  });

  test("Customize lets the user enable analytics-only", async ({
    page,
    context,
  }) => {
    await page.goto("/");

    const banner = page.getByRole("dialog", { name: /cookies/i });
    await banner.getByRole("button", { name: /^customize$/i }).click();

    // Analytics checkbox starts unchecked
    const analyticsCb = banner.getByRole("checkbox", { name: /analytics/i });
    await expect(analyticsCb).not.toBeChecked();
    await analyticsCb.check();

    const marketingCb = banner.getByRole("checkbox", { name: /marketing/i });
    await expect(marketingCb).not.toBeChecked();

    await banner.getByRole("button", { name: /save preferences/i }).click();

    const cookies = await context.cookies();
    const consent = cookies.find((c) => c.name === "bz_consent");
    expect(consent).toBeDefined();
    const parsed = JSON.parse(decodeURIComponent(consent!.value));
    expect(parsed.analytics).toBe(true);
    expect(parsed.marketing).toBe(false);
  });

  test("banner does not re-appear after a decision on next navigation", async ({
    page,
  }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: /cookies/i });
    await banner.getByRole("button", { name: /^accept all$/i }).click();
    await expect(banner).toBeHidden();

    await page.goto("/buy");
    await expect(page.getByRole("dialog", { name: /cookies/i })).toBeHidden();
  });
});
