import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isNonLocalisedPath } from "./non-localised";

/**
 * Every route handler on disk is covered by the non-localised guard.
 *
 * The proxy matcher excludes only paths containing a dot, so all 28 route
 * handlers here are matched by the proxy. If a locale rewrite reaches them the
 * result is a 404 on every API call — and because the matcher *looks* like it
 * excludes them, the mistake is easy to make twice.
 *
 * Modelled on lib/cron-routes.test.ts: derive the expectation from the tree
 * rather than restating it, so adding `app/api/foo/route.ts` next month fails
 * here rather than in production.
 */
const REPO_ROOT = path.join(__dirname, "..", "..");

/** Every `route.ts` in the app tree, as the URL path it serves. */
function routeHandlerPaths(): string[] {
  const out: string[] = [];

  function walk(dir: string, url: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Route groups like (public) don't appear in the URL.
        const segment = /^\(.*\)$/.test(entry.name) ? url : `${url}/${entry.name}`;
        walk(abs, segment);
      } else if (entry.name === "route.ts") {
        out.push(url || "/");
      }
    }
  }

  walk(path.join(REPO_ROOT, "app"), "");
  return out.sort();
}

/**
 * Route handlers that are page-adjacent and DO move under `[locale]`.
 * Empty today; listed as a seam so a future localised handler is a deliberate
 * entry here rather than a silently failing assertion.
 */
const LOCALISED_HANDLERS: string[] = [];

describe("non-localised paths", () => {
  it("covers every route handler in the app tree", () => {
    const handlers = routeHandlerPaths();
    // Sanity: if the walk breaks, everything below passes vacuously.
    expect(handlers.length).toBeGreaterThan(20);

    const uncovered = handlers
      .filter((p) => !LOCALISED_HANDLERS.includes(p))
      // A dynamic segment stands in for any concrete value.
      .filter((p) => !isNonLocalisedPath(p.replace(/\[[^\]]+\]/g, "x")));

    expect(
      uncovered,
      `These route handlers would be rewritten into a locale segment that no ` +
        `route serves — a 404 on every call:\n${uncovered.join("\n")}`,
    ).toEqual([]);
  });

  it("does not swallow the public pages", () => {
    for (const page of [
      "/",
      "/buy",
      "/buy/search",
      "/p/some-villa-baz-ab-1042",
      "/areas/saadiyat-island",
      "/insights",
      "/contact-qr",
      "/legal/privacy",
      "/admin",
      "/admin/properties",
    ]) {
      expect(isNonLocalisedPath(page), `${page} must stay localisable`).toBe(
        false,
      );
    }
  });

  it("separates the vCard handler from the page that links to it", () => {
    expect(isNonLocalisedPath("/contact-qr/vcard")).toBe(true);
    expect(isNonLocalisedPath("/contact-qr")).toBe(false);
  });
});
