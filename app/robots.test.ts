import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import robots from "./robots";

/**
 * A robots.txt `Disallow` is a PREFIX, not a path segment.
 *
 * `Disallow: /ar`, written to hide the Arabic tree while it is under review,
 * also matched `/areas`. Under RFC 9309 the longest matching rule wins, so it
 * beat the `Allow: /` beside it and took the whole area-guide tree out of
 * Google's index — `/areas` and all nineteen `/areas/<slug>` pages, none of
 * which carry `noindex`, all of which the sitemap advertises. Nothing errored
 * and nothing in the build said so; the pages simply stopped being crawlable.
 *
 * The rule is three characters long, which is the whole problem: the shorter
 * a disallow is, the more of the site it can silently swallow. This test
 * walks the real public route tree and asserts that nothing outside the
 * Arabic locale is blocked, so the next short prefix is caught here rather
 * than in Search Console six weeks later.
 */

/** RFC 9309 §2.2.2: longest matching rule wins; a tie goes to Allow. */
function isAllowed(
  rules: { type: "allow" | "disallow"; value: string }[],
  urlPath: string,
): boolean {
  let best: { type: "allow" | "disallow"; length: number } | null = null;
  for (const rule of rules) {
    // `$` anchors the end of the path. `*` is unused in our robots.txt; if it
    // ever appears, this helper must learn it before the test is trusted.
    const anchored = rule.value.endsWith("$");
    const pattern = anchored ? rule.value.slice(0, -1) : rule.value;
    const matches = anchored
      ? urlPath === pattern
      : urlPath.startsWith(pattern);
    if (!matches) continue;
    const length = pattern.length;
    if (!best || length > best.length) best = { type: rule.type, length };
    else if (length === best.length && rule.type === "allow")
      best = { type: "allow", length };
  }
  return best ? best.type === "allow" : true;
}

function parsedRules() {
  const group = robots().rules;
  const first = Array.isArray(group) ? group[0] : group;
  const toList = (v: string | string[] | undefined) =>
    v === undefined ? [] : Array.isArray(v) ? v : [v];
  return [
    ...toList(first.allow).map((value) => ({ type: "allow" as const, value })),
    ...toList(first.disallow).map((value) => ({
      type: "disallow" as const,
      value,
    })),
  ];
}

/** Every public route, as a concrete crawlable path. */
function publicRoutePaths(): string[] {
  const root = path.join(process.cwd(), "app", "[locale]", "(public)");
  const found: string[] = [];

  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      // Private folders (_components, _actions) hold no routes.
      if (name.startsWith("_")) continue;
      const next = name.startsWith("(")
        ? segments // route groups add no URL segment
        : [...segments, name.startsWith("[") ? "sample-slug" : name];
      walk(path.join(dir, name), next);
      found.push("/" + next.join("/"));
    }
  };

  walk(root, []);
  return [...new Set(found)];
}

describe("robots.txt does not block the public site", () => {
  const rules = parsedRules();

  it("allows every public route", () => {
    const blocked = publicRoutePaths().filter((p) => !isAllowed(rules, p));
    expect(blocked).toEqual([]);
  });

  it("still hides the Arabic tree, which is what the /ar rules are for", () => {
    for (const p of ["/ar", "/ar/", "/ar/buy", "/ar/areas/saadiyat-island"]) {
      expect(isAllowed(rules, p), `${p} should be disallowed`).toBe(false);
    }
  });

  it("still hides the CMS, accounts and the API", () => {
    for (const p of ["/admin", "/admin/login", "/account", "/api/health"]) {
      expect(isAllowed(rules, p), `${p} should be disallowed`).toBe(false);
    }
  });

  it("keeps /areas crawlable — the regression this file exists for", () => {
    expect(isAllowed(rules, "/areas")).toBe(true);
    expect(isAllowed(rules, "/areas/saadiyat-island")).toBe(true);
  });
});
