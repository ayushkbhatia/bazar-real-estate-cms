/**
 * @vitest-environment node
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_WORDPRESS_REDIRECTS } from "./legacy-redirects";

/**
 * The two ways a legacy-redirect map goes wrong, and neither is visible in
 * review:
 *
 *  1. A catch-all shadows a live route. `/agents/:slug*` looks like the right
 *     rule for a WordPress agent archive and would take down the advisor
 *     directory this site actually serves — a 301 in `next.config.ts` runs
 *     before the filesystem, so the real page becomes unreachable with no
 *     error anywhere.
 *  2. A rule redirects to a 404. That is strictly worse than the 404 it
 *     replaced: it spends a hop and still fails, and Google reads the whole
 *     chain as a soft 404.
 *
 * Both are cheap to assert and impossible to notice by hand once the map is
 * thirty rules long.
 */

const PUBLIC_DIR = path.join(process.cwd(), "app", "[locale]", "(public)");

/** Top-level path segments this site serves, read from the router itself. */
function liveTopLevelSegments(): Set<string> {
  return new Set(
    readdirSync(PUBLIC_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
      .map((e) => e.name),
  );
}

/** The first path segment a `source` can match — "/blog/:slug*" → "blog". */
function firstSegment(source: string): string {
  return source.split("/").filter(Boolean)[0] ?? "";
}

describe("the WordPress redirect map", () => {
  it("never shadows a route this site serves", () => {
    const live = liveTopLevelSegments();
    const collisions = LEGACY_WORDPRESS_REDIRECTS.filter(
      (r) =>
        // A rule gated on a query parameter only fires when that parameter is
        // present, so it cannot shadow the bare path. `/?lang=ar` is the one.
        !r.has && live.has(firstSegment(r.source)),
    ).map((r) => r.source);
    expect(collisions, "these sources would take a live route down").toEqual(
      [],
    );
  });

  it("keeps /agents reachable — only the WordPress singular is redirected", () => {
    // The specific instance of the rule above that is easiest to get wrong,
    // pinned on its own so a future edit fails loudly rather than subtly.
    const sources = LEGACY_WORDPRESS_REDIRECTS.map((r) => r.source);
    expect(sources).toContain("/agent/:slug*");
    expect(sources).not.toContain("/agents/:slug*");
    expect(sources).not.toContain("/agents");
  });

  it("sends every rule to a route that exists", () => {
    // Destinations are static strings, so the set of pages they can land on is
    // finite and checkable. `/buy/search` and `/ar` are directories one level
    // down rather than top-level segments, hence the explicit allowance.
    const live = liveTopLevelSegments();
    const NESTED_OK = new Set(["/buy/search", "/ar"]);
    for (const rule of LEGACY_WORDPRESS_REDIRECTS) {
      const dest = rule.destination.split("?")[0]!;
      if (NESTED_OK.has(dest)) continue;
      expect(
        live.has(firstSegment(dest)),
        `${rule.source} → ${rule.destination} is not a route`,
      ).toBe(true);
    }
  });

  it("never passes a captured segment through to a destination", () => {
    /*
     * Every destination is a fixed page. A rule like
     * `/rlisting_city/:term*` → `/areas/:term*` would look tidier and would
     * 404 for almost every term the old site used — its cities were Abu Dhabi
     * municipal districts, and `areas` holds 26 slugs that mostly do not
     * match. The map deliberately lands on the index instead.
     */
    for (const rule of LEGACY_WORDPRESS_REDIRECTS) {
      expect(
        rule.destination,
        `${rule.source} interpolates a captured segment`,
      ).not.toMatch(/:/);
    }
  });

  it("puts every specific term ahead of the catch-all that would swallow it", () => {
    // Next matches `redirects()` in array order. A catch-all placed above a
    // specific term silently wins, which is how a commercial search ends up
    // on /buy.
    const indexOf = (source: string) =>
      LEGACY_WORDPRESS_REDIRECTS.findIndex((r) => r.source === source);
    for (const family of ["rlisting_status", "rlisting_type"]) {
      const catchAll = indexOf(`/${family}/:term*`);
      expect(catchAll, `${family} has no catch-all`).toBeGreaterThan(-1);
      const specifics = LEGACY_WORDPRESS_REDIRECTS.map((r, i) => ({ r, i }))
        .filter(
          ({ r }) =>
            r.source.startsWith(`/${family}/`) && !r.source.includes(":"),
        )
        .map(({ i }) => i);
      expect(specifics.length, `${family} has no specific terms`).toBeGreaterThan(0);
      expect(Math.max(...specifics)).toBeLessThan(catchAll);
    }
  });

  it("redirects permanently — a 301 is what moves ranking", () => {
    for (const rule of LEGACY_WORDPRESS_REDIRECTS) {
      expect(rule.permanent, rule.source).toBe(true);
    }
  });

  it("covers both paths a live site: query confirms are indexed", () => {
    const sources = LEGACY_WORDPRESS_REDIRECTS.map((r) => r.source);
    expect(sources).toContain("/listings");
    expect(sources).toContain("/rlisting_status/residential");
  });
});
