import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * Pages & blocks → Mortgage stages (Bazar, 13 Oct 2026): the Head renames a
 * stage, adds one and deletes it, moves one up, and is refused deleting a
 * stage files are on. Writes `mortgage_stages`, so local only, and puts the
 * stages back as they were at the end.
 */

const BASE = process.env.MORTGAGE_E2E_BASE_URL;
const LOCAL = !!BASE && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(BASE);
test.skip(!LOCAL, "Runs only against the local stack (MORTGAGE_E2E_BASE_URL=http://localhost:3107): it writes to its database.");

// The local seed's Head of mortgages (scripts/db-local/seed-mortgage.ts). Local test credentials only.
const HEAD = { email: "yasmin.abdalla@example.com", password: process.env.MORTGAGE_E2E_PASSWORD ?? "local-only-mortgage-seed" };
const SHOTS = process.env.MORTGAGE_E2E_SHOTS;

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_bazar-local", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

type StageRow = { id: string; name: string; position: number; stops_clock: boolean; closes_file: boolean };

function stages(): StageRow[] {
  return JSON.parse(
    sql(
      `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'position', position,
         'stops_clock', stops_clock, 'closes_file', closes_file) order by position), '[]'::jsonb)
         from public.mortgage_stages`,
    ),
  ) as StageRow[];
}

const ADDED = "E2E stage";
let original: StageRow[] = [];

/** The stages as they were: the added one gone, every original's name, place and switches back. */
function restore() {
  if (original.length === 0) return;
  const json = JSON.stringify(original).replace(/'/g, "''");
  const ids = original.map((s) => `'${s.id}'`).join(", ");
  sql(
    `delete from public.mortgage_stages s
      where s.id not in (${ids})
        and not exists (select 1 from public.mortgage_requests r where r.stage_id = s.id);
     update public.mortgage_stages s
        set name = o.name, position = o.position, stops_clock = o.stops_clock, closes_file = o.closes_file
       from jsonb_to_recordset('${json}'::jsonb) as o(id uuid, name text, position integer, stops_clock boolean, closes_file boolean)
      where s.id = o.id;`,
  );
}

async function signIn(page: Page) {
  await page.context().addCookies([
    {
      name: "bz_consent",
      value: encodeURIComponent(JSON.stringify({ essential: true, analytics: false, marketing: false, decided_at: new Date().toISOString(), version: 1 })),
      url: BASE!,
    },
  ]);
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(HEAD.email);
  await page.getByRole("textbox", { name: "Password" }).fill(HEAD.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"));
}

const row = (page: Page, id: string) => page.locator(`li[data-stage-id="${id}"]`);

test.afterAll(() => {
  restore();
});

test("the Head keeps the mortgage stages in Pages & blocks", async ({ page }) => {
  test.setTimeout(120_000);
  original = stages();
  expect(original.length).toBeGreaterThanOrEqual(3);
  sql(`delete from public.mortgage_stages where name = '${ADDED}'`);
  await signIn(page);

  await page.goto("/admin/pages");
  await page.getByRole("link", { name: /Mortgage stages/ }).click();
  await page.waitForURL(/\/admin\/pages\/mortgage-stages$/);
  await expect(page.getByText("The stages a Fast Pre-Approval moves through")).toBeVisible();
  await expect(page.locator("li[data-stage-id]")).toHaveCount(original.length);

  // Rename a stage and switch it to close the file: both saved.
  const target = original[1]!;
  const renamed = `${target.name} (e2e)`.slice(0, 40);
  const r = row(page, target.id);
  await r.getByRole("textbox").fill(renamed);
  await r.getByRole("checkbox", { name: "Closes the file" }).setChecked(!target.closes_file);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stages-editor.png`, fullPage: false });
  await r.getByRole("button", { name: "Save stage 2" }).click();
  await expect(page.getByText(/^Saved “/).first()).toBeVisible();
  expect(sql(`select name || '|' || closes_file from public.mortgage_stages where id = '${target.id}'`)).toBe(
    `${renamed}|${!target.closes_file}`,
  );

  // Add a stage: it goes in last. Then delete it.
  await page.getByRole("textbox", { name: "New stage" }).fill(ADDED);
  await page.getByRole("button", { name: "Add stage" }).click();
  await expect(page.getByText(/^Added “E2E stage”/).first()).toBeVisible();
  expect(sql(`select position from public.mortgage_stages where name = '${ADDED}'`)).toBe(String(original.length + 1));
  await expect(page.locator("li[data-stage-id]")).toHaveCount(original.length + 1);

  await page.getByRole("button", { name: `Delete ${ADDED}`, exact: true }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText(`Delete “${ADDED}”?`)).toBeVisible();
  await confirm.getByRole("button", { name: "Delete stage" }).click();
  await expect(page.getByText(/^Deleted “E2E stage”/).first()).toBeVisible();
  expect(sql(`select count(*) from public.mortgage_stages where name = '${ADDED}'`)).toBe("0");
  await expect(page.locator("li[data-stage-id]")).toHaveCount(original.length);

  // Move the third stage up: it is second, and the second is third.
  const third = original[2]!;
  await page.getByRole("button", { name: `Move ${third.name} up`, exact: true }).click();
  await expect(page.getByText(/^New order saved/).first()).toBeVisible();
  expect(sql(`select position from public.mortgage_stages where id = '${third.id}'`)).toBe("2");
  expect(sql(`select position from public.mortgage_stages where id = '${target.id}'`)).toBe("3");
  await expect(page.locator("li[data-stage-id]").nth(1)).toHaveAttribute("data-stage-id", third.id);

  // A stage files are on can't be deleted, and the dialog says why.
  const busy = sql(
    `select s.id || '|' || s.name || '|' || count(r.id)
       from public.mortgage_stages s join public.mortgage_requests r on r.stage_id = s.id
      group by s.id order by count(r.id) desc, s.position limit 1`,
  );
  expect(busy, "the local seed puts files on a stage").not.toBe("");
  const [busyId, busyName, files] = busy.split("|") as [string, string, string];
  const n = Number(files);
  await page.getByRole("button", { name: `Delete ${busyName}`, exact: true }).click();
  await confirm.getByRole("button", { name: "Delete stage" }).click();
  await expect(confirm.getByRole("alert")).toHaveText(
    n === 1
      ? "1 file is on this stage. Move it to another stage first."
      : `${n} files are on this stage. Move them to another stage first.`,
  );
  expect(sql(`select count(*) from public.mortgage_stages where id = '${busyId}'`)).toBe("1");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);

  // Back as it was; the screen reads it.
  restore();
  await page.reload();
  await expect(row(page, target.id).getByRole("textbox")).toHaveValue(target.name);
});
