import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * C1's board (Bazar, 9 Oct 2026): the open files in a column per status,
 * moved by dragging. Each run makes its own requests, so the seed's stay as
 * they are for the other specs.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
const LOCAL = !!BASE && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE);
test.skip(!LOCAL, "Runs only against the local stack (MORTGAGE_E2E_BASE_URL=http://localhost:3107): it writes to its database.");

// The local seed's Head of mortgages (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const HEAD = { email: "yasmin.abdalla@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };
const YASMIN = "5eed0000-0000-4000-8000-000000000001";
const SHOTS = process.env.MORTGAGE_E2E_SHOTS;

/** SQL as the local database's superuser, in its container. Values here are the spec's own, never input. */
function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_bazar-local", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", query],
    { encoding: "utf8" },
  )
    .split("\n")[0]!
    .trim();
}

/** A new request of the spec's own, owned by the Head. */
function newRequest(service: "pre_approval" | "consultancy", name: string): string {
  const tag = randomUUID().slice(0, 8);
  const reference = sql(`
    select (public.mortgage_create_request(
      p_service => '${service}', p_full_name => '${name}', p_date_of_birth => '1988-06-02',
      p_mobile_e164 => '+971501234567', p_email => 'board-${tag}@example.com',
      p_residency => 'uae_resident_expat', p_employment_type => 'salaried', p_entry_point => 'home',
      ${service === "pre_approval" ? "p_consent_version => 'v0.1', p_consent_text => 'Consent.', p_sla_due_at => now() + interval '2 days'," : ""}
      p_locale => 'en'
    )).reference`);
  sql(`update public.mortgage_requests set owner_staff_id = '${YASMIN}' where reference = '${reference}' returning 1`);
  return reference;
}

const status = (reference: string) => sql(`select status from public.mortgage_requests where reference = '${reference}'`);
const stage = (reference: string) =>
  sql(`select s.name from public.mortgage_requests r join public.mortgage_stages s on s.id = r.stage_id where r.reference = '${reference}'`);

async function signIn(page: Page) {
  await page.context().addCookies([
    {
      name: "bz_consent",
      value: encodeURIComponent(
        JSON.stringify({ essential: true, analytics: false, marketing: false, decided_at: new Date().toISOString(), version: 1 }),
      ),
      url: BASE!,
    },
  ]);
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(HEAD.email);
  await page.getByRole("textbox", { name: "Password" }).fill(HEAD.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"));
}

const card = (page: Page, reference: string) => page.locator(`[data-reference="${reference}"]`).first();
const column = (page: Page, lane: string, status: string) =>
  page.getByRole("region", { name: lane }).getByRole("group", { name: new RegExp(`^${status},`) });

/** dnd-kit's pointer sensor wants real movement: press on the grip, travel, release over the column. */
async function drag(page: Page, from: Locator, to: Locator) {
  // Both ends on screen: a lane further down the page is scrolled to first.
  await to.scrollIntoViewIfNeeded();
  await from.scrollIntoViewIfNeeded();
  const grip = from.getByRole("button", { name: /^Move BZM/ }).first();
  const a = (await grip.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 10, { steps: 4 });
  // A lane's columns share one height, so the card's own height is inside the target column, and on screen.
  const y = Math.min(Math.max(a.y + a.height / 2, b.y + 40), b.y + b.height - 20);
  await page.mouse.move(b.x + b.width / 2, y, { steps: 12 });
  await page.mouse.up();
}

test("the board: stages as columns, a free move from the Move menu, back again by dragging, decline, log a contact", async ({ page }) => {
  test.setTimeout(120_000);
  const fresh = newRequest("pre_approval", "Board Tester");
  const other = newRequest("pre_approval", "Board Decliner");
  const consult = newRequest("consultancy", "Board Caller");

  await signIn(page);
  // Wide enough for every stage column, and tall enough that a long New column doesn't make the page
  // scroll: dnd-kit auto-scrolls near the edge, and a scrolling board moves the drop target mid-drag.
  await page.setViewportSize({ width: 2560, height: 4000 });
  // The board re-reads itself as soon as it mounts; drag only once that answer is in, or the card is
  // re-rendered from under the pointer.
  const firstRead = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/mortgages"));
  await page.goto("/admin/mortgages?view=board");
  await firstRead;

  const pre = "Fast Pre-Approval";
  await expect(page.getByRole("radio", { name: "Board" })).toHaveAttribute("aria-checked", "true");
  // The client's stages (0158), then Declined.
  for (const s of ["New", "In Review", "Accepted", "Pre-Approved", "Valuation", "Final Offer Letter", "Registration", "Disbursed", "Declined"]) {
    await expect(column(page, pre, s)).toBeVisible();
  }
  await expect(column(page, pre, "New").locator(`[data-reference="${fresh}"]`)).toBeVisible();
  expect(stage(fresh)).toBe("New");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/board.png` });

  // New → Valuation, skipping stages, from the card's Move menu: moved at once, and the clock stops
  // (Valuation answers the applicant).
  await card(page, fresh).getByRole("button", { name: `Move ${fresh} to` }).last().click();
  await page.getByRole("menuitem", { name: "Valuation" }).click();
  await expect(page.getByText(`${fresh} moved to Valuation.`)).toBeVisible();
  await expect(column(page, pre, "Valuation").locator(`[data-reference="${fresh}"]`)).toBeVisible();
  expect(status(fresh)).toBe("open");
  expect(stage(fresh)).toBe("Valuation");
  expect(sql(`select sla_stopped_at is not null from public.mortgage_requests where reference = '${fresh}'`)).toBe("t");
  expect(sql(`select count(*) from public.mortgage_events e join public.mortgage_requests r on r.id = e.request_id where r.reference = '${fresh}' and e.type = 'stage.changed'`)).toBe("1");

  // Back to In Review: free, and the stopped clock stays stopped. Let the board's re-read settle first,
  // or the card is swapped out from under the pointer mid-drag.
  await expect(page.getByText(`${fresh} moved to Valuation.`)).toBeHidden({ timeout: 10_000 });
  await drag(page, card(page, fresh), column(page, pre, "In Review"));
  await expect(page.getByText(`${fresh} moved to In Review.`)).toBeVisible();
  await expect(column(page, pre, "In Review").locator(`[data-reference="${fresh}"]`)).toBeVisible();
  expect(stage(fresh)).toBe("In Review");
  expect(sql(`select sla_stopped_at is not null from public.mortgage_requests where reference = '${fresh}'`)).toBe("t");

  // Declined from the Move menu: the decline dialog, on the board.
  await card(page, other).getByRole("button", { name: `Move ${other} to` }).last().click();
  await page.getByRole("menuitem", { name: "Declined" }).click();
  const decline = page.getByRole("dialog", { name: /Decline/ });
  await expect(decline).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-decline.png` });
  await decline.getByRole("button", { name: "Cancel" }).click();
  expect(status(other)).toBe("open");

  // Consultancy New → Contacted: how did it go?
  const consultancy = "Mortgage Consultancy";
  await drag(page, card(page, consult), column(page, consultancy, "Contacted"));
  await page.getByRole("dialog").getByRole("button", { name: "Reached" }).click();
  await expect(column(page, consultancy, "Contacted").locator(`[data-reference="${consult}"]`)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-consultancy.png` });
  expect(status(consult)).toBe("contacted");
});
