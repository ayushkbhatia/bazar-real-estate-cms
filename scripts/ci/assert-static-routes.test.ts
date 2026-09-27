/**
 * @vitest-environment node
 *
 * G-1's one exception: a pattern whose pages come from content that can be
 * empty. This runs the real script against a fake build, because what is
 * under test is how it reads Next's manifest. The shapes come from a probe
 * build on Next 16.2.6: a zero-param ISR pattern is absent from `routes` but
 * still present in `dynamicRoutes`; a route that went dynamic is in neither.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = import.meta.dirname;
const BASELINE: Record<string, { revalidate: number | false }> = JSON.parse(
  readFileSync(path.join(HERE, "route-render-baseline.json"), "utf8"),
).routes;

type Manifest = {
  routes: Record<
    string,
    { srcRoute: string; initialRevalidateSeconds: number | false }
  >;
  dynamicRoutes: Record<string, object>;
};

/** A build that prerendered every baseline route at its recorded interval. */
function fullBuild(): Manifest {
  const manifest: Manifest = { routes: {}, dynamicRoutes: {} };
  for (const [route, { revalidate }] of Object.entries(BASELINE)) {
    const src = `/[locale]${route === "/" ? "" : route}`;
    manifest.routes[`/en${route.replace(/\[[^\]]+\]/g, "x")}`] = {
      srcRoute: src,
      initialRevalidateSeconds: revalidate,
    };
    if (route.includes("[")) manifest.dynamicRoutes[src] = {};
  }
  return manifest;
}

/** Drop a pattern's pages; `andRegistration` drops it from `dynamicRoutes` too. */
function without(
  manifest: Manifest,
  route: string,
  { andRegistration = false } = {},
): Manifest {
  const src = `/[locale]${route}`;
  const routes = Object.fromEntries(
    Object.entries(manifest.routes).filter(([, r]) => r.srcRoute !== src),
  );
  const dynamicRoutes = { ...manifest.dynamicRoutes };
  if (andRegistration) delete dynamicRoutes[src];
  return { routes, dynamicRoutes };
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "check-routes-"));
  mkdirSync(path.join(root, "scripts", "ci"), { recursive: true });
  mkdirSync(path.join(root, ".next"));
  for (const file of ["assert-static-routes.mjs", "route-render-baseline.json"]) {
    copyFileSync(path.join(HERE, file), path.join(root, "scripts", "ci", file));
  }
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Run the real script against `manifest`, as CI does after `next build`. */
function checkRoutes(manifest: Manifest): { code: number; output: string } {
  writeFileSync(
    path.join(root, ".next", "prerender-manifest.json"),
    JSON.stringify(manifest),
  );
  try {
    const output = execFileSync(
      process.execPath,
      [path.join(root, "scripts", "ci", "assert-static-routes.mjs")],
      { encoding: "utf8", stdio: "pipe" },
    );
    return { code: 0, output };
  } catch (err) {
    const { status, stdout, stderr } = err as {
      status: number;
      stdout: string;
      stderr: string;
    };
    return { code: status, output: `${stdout}${stderr}` };
  }
}

describe("check:routes", () => {
  it("passes a build that prerendered every baseline route", () => {
    expect(checkRoutes(fullBuild()).code).toBe(0);
  });

  it("passes /lp/[slug] with no landing pages published, and says so", () => {
    const result = checkRoutes(without(fullBuild(), "/lp/[slug]"));
    expect(result.code).toBe(0);
    expect(result.output).toMatch(/No content to prerender[^]*\/lp\/\[slug\]/);
  });

  it("still fails /lp/[slug] when it went dynamic", () => {
    const result = checkRoutes(
      without(fullBuild(), "/lp/[slug]", { andRegistration: true }),
    );
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/now rendered on demand:\s+\/lp\/\[slug\]/);
  });

  it("still fails any other pattern that prerendered nothing — there, an empty param list is the bug", () => {
    const result = checkRoutes(without(fullBuild(), "/areas/[slug]"));
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/now rendered on demand:\s+\/areas\/\[slug\]/);
  });
});
