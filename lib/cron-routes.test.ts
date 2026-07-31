import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cron schedules and cron routes must agree.
 *
 * ADR-0003 chose Vercel Cron over Inngest and named the trade-off explicitly:
 * the silent-failure surface. A schedule pointing at a route that no longer
 * exists is a job that quietly stops running — nothing errors, nothing pages,
 * the work just never happens. The reverse (a route with no schedule) is a job
 * that only ever runs if someone curls it.
 *
 * This drift already bit once: five jobs were removed in #219, and four e2e
 * specs kept asserting the deleted routes were fail-closed. They were not
 * fail-closed; they were 404. The tests failed for months on a red main.
 */
const REPO_ROOT = path.join(__dirname, "..");

function scheduledPaths(): string[] {
  const raw = readFileSync(path.join(REPO_ROOT, "vercel.json"), "utf8");
  const parsed = JSON.parse(raw) as { crons?: { path: string }[] };
  return (parsed.crons ?? []).map((c) => c.path);
}

function routesOnDisk(): string[] {
  const dir = path.join(REPO_ROOT, "app", "api", "cron");
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `/api/cron/${e.name}`)
    .sort();
}

describe("cron wiring", () => {
  it("schedules only routes that exist", () => {
    const onDisk = new Set(routesOnDisk());
    const missing = scheduledPaths().filter((p) => !onDisk.has(p));
    expect(
      missing,
      `vercel.json schedules ${missing.join(", ")}, which no route serves — those jobs are silently dead`,
    ).toEqual([]);
  });

  it("schedules every route that exists", () => {
    const scheduled = new Set(scheduledPaths());
    const unscheduled = routesOnDisk().filter((r) => !scheduled.has(r));
    expect(
      unscheduled,
      `${unscheduled.join(", ")} exist but are never scheduled — they only run if someone calls them by hand`,
    ).toEqual([]);
  });

  it("gives every cron route a handler", () => {
    for (const route of routesOnDisk()) {
      const name = route.replace("/api/cron/", "");
      const handler = path.join(REPO_ROOT, "app", "api", "cron", name, "route.ts");
      expect(() => readFileSync(handler, "utf8"), `${route} has no route.ts`).not.toThrow();
    }
  });
});
