import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SupabaseReadError, readFailed } from "./read-failure";

const REPO_ROOT = path.join(__dirname, "..", "..");

describe("SupabaseReadError", () => {
  it("names the scope and the underlying message", () => {
    const err = new SupabaseReadError("getPublishedArticleBySlug", {
      message: "fetch failed",
      code: "PGRST301",
    });
    expect(err.message).toContain("getPublishedArticleBySlug");
    expect(err.message).toContain("fetch failed");
    expect(err.message).toContain("PGRST301");
    expect(err.scope).toBe("getPublishedArticleBySlug");
    expect(err.code).toBe("PGRST301");
  });

  it("survives an error with nothing on it", () => {
    const err = new SupabaseReadError("x", undefined);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("unknown error");
  });

  it("readFailed throws rather than returning", () => {
    expect(() => readFailed("scope", { message: "boom" })).toThrow(
      SupabaseReadError,
    );
  });
});

/**
 * The lockfile.
 *
 * Each of these functions backs a page that calls `notFound()` on `null`, and
 * a 404 out of a route with `revalidate` set is CACHED — so returning null on
 * a failed read publishes "this page does not exist" for the length of the
 * window. That is the production bug of 2026-09-09: 22 of 32 broken links
 * found by crawling `/ar` were live pages serving a cached 404, all of which
 * healed the moment something requested them a second time.
 *
 * Asserted on the source text rather than by mocking a client, because what
 * has to stay true is a property of the code — "this branch throws" — and the
 * regression it guards against is someone restoring the friendlier-looking
 * `console.error(...); return null` a few months from now.
 */
const MUST_THROW: { file: string; fn: string }[] = [
  { file: "lib/queries/articles.ts", fn: "getPublishedArticleBySlug" },
  { file: "lib/queries/articles.ts", fn: "getStaffByPublicSlug" },
  { file: "lib/queries/developments.ts", fn: "getPublishedDevelopmentBySlug" },
  { file: "lib/queries/pages.ts", fn: "getPublishedPageBySlug" },
  { file: "lib/queries/landing-pages.ts", fn: "getPublishedLandingBySlug" },
  {
    file: "lib/queries/properties.ts",
    fn: "getPublishedPropertyByReference",
  },
  { file: "lib/queries/market-reports.ts", fn: "lookupAreaName" },
];

describe("reads behind notFound() report failure instead of absence", () => {
  for (const { file, fn } of MUST_THROW) {
    it(`${fn} calls readFailed on a read error`, () => {
      const src = readFileSync(path.join(REPO_ROOT, file), "utf8");
      expect(src, `${file} should import readFailed`).toContain(
        "read-failure",
      );
      expect(src, `${fn} should hand its error to readFailed`).toContain(
        `readFailed("${fn}", error)`,
      );
    });
  }

  it("none of them still swallow the error into a null", () => {
    for (const { file, fn } of MUST_THROW) {
      const src = readFileSync(path.join(REPO_ROOT, file), "utf8");
      expect(src, `${file} still logs-and-nulls for ${fn}`).not.toContain(
        `console.error("[${fn}]", error);`,
      );
    }
  });
});
