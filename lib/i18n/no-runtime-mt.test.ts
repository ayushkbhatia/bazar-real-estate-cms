/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/**
 * G-17 — rendering a page never calls a language model.
 *
 * The Arabic content build generates its drafts offline, from a CLI, and
 * commits the result as `_ar` values. Production reads them: `localiseRow`
 * (`lib/i18n/localise.ts`) and `applyLocale` (`lib/master-pages/i18n.ts`) take
 * a row and a locale, drop the `_ar` keys, and return. No network, no model,
 * no key.
 *
 * That property is the whole reason the feature survives handover. The client
 * can leave `ANTHROPIC_API_KEY` unset forever and every Arabic page still
 * renders. It is also completely invisible: nothing fails, nothing warns, and
 * an `await translateField(...)` added to a render path would look like a
 * feature until the first request on a production box with no key — where it
 * would fail *closed*, and the page would silently fall back to English for
 * every visitor.
 *
 * So it is asserted rather than assumed, by walking the import graph from every
 * public entry point rather than grepping the entry points themselves — the
 * failure would arrive three hops down, inside a helper nobody thought of as
 * a render path.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The package no render path may reach. */
const FORBIDDEN = "@anthropic-ai/sdk";

/**
 * The two modules allowed to import it, and why.
 *
 * Both are real features and neither is reachable from a public render.
 * **Shrink only** — a third entry is a new runtime model dependency and needs
 * to be a deliberate decision, not a diff nobody read.
 */
const SDK_IMPORTERS: Readonly<Record<string, string>> = {
  "lib/concierge/anthropic.ts":
    "the AI Concierge — a chat product, not a render path; already degrades closed without a key",
  "app/[locale]/(admin)/admin/properties/[id]/_translate-actions.ts":
    "the per-field admin translate button; staff-only, and returns a typed error when the key is unset",
  "lib/i18n/mt/hf-client.ts":
    "the provider shim — imports the SDK lazily inside `mtClientFromEnv`, which only the authoring scripts call. The reachability half of this file is what actually guards it: no public entry point can reach this module at all.",
};

function sourceFiles(): string[] {
  return execFileSync("git", ["ls-files", "app", "components", "lib"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts"))
    .filter((f) => !/\.(test|spec)\.tsx?$/.test(f));
}

const IMPORT_RE = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

/** `@/lib/x` and `./x` to a repo-relative path, or null for a bare package. */
function resolve(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else return null;

  for (const c of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (/\.tsx?$/.test(c) && existsSync(join(REPO_ROOT, c))) return c;
  }
  return null;
}

type Graph = { edges: Map<string, string[]>; direct: Set<string> };

function graph(): Graph {
  const edges = new Map<string, string[]>();
  const direct = new Set<string>();

  for (const file of sourceFiles()) {
    const src = readFileSync(join(REPO_ROOT, file), "utf8");
    const out: string[] = [];
    for (const [, spec] of src.matchAll(IMPORT_RE)) {
      if (spec === FORBIDDEN || spec!.startsWith(`${FORBIDDEN}/`)) {
        direct.add(file);
        continue;
      }
      const target = resolve(spec!, file);
      if (target) out.push(target);
    }
    edges.set(file, out);
  }
  return { edges, direct };
}

/** Every public page, layout and route handler — what a visitor can reach. */
function publicEntries(): string[] {
  return sourceFiles().filter(
    (f) =>
      f.startsWith("app/[locale]/(public)/") &&
      /\/(page|layout|template|route|loading|error|not-found|opengraph-image|sitemap|robots)\.tsx?$/.test(
        f,
      ),
  );
}

/** The forbidden module a public entry can reach, with the path that gets there. */
function reachesModel(g: Graph, entry: string): string[] | null {
  const seen = new Set<string>();
  const stack: { file: string; trail: string[] }[] = [
    { file: entry, trail: [entry] },
  ];

  while (stack.length) {
    const { file, trail } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (g.direct.has(file)) return trail;
    for (const next of g.edges.get(file) ?? []) {
      if (!seen.has(next)) stack.push({ file: next, trail: [...trail, next] });
    }
  }
  return null;
}

describe("G-17 · no model call on a render path", () => {
  it("keeps the SDK importers to the two that are allowed", () => {
    const surprises = [...graph().direct].filter((f) => !(f in SDK_IMPORTERS));

    expect(
      surprises.sort(),
      `These modules import ${FORBIDDEN}:\n${surprises.sort().join("\n")}\n\n` +
        `The Arabic content build is generated offline and committed, so ` +
        `production never needs a model to render Arabic. Adding a runtime ` +
        `model dependency means the feature stops working when the client ` +
        `leaves the key unset after handover — and it fails closed and ` +
        `silently, falling back to English for every visitor.\n\n` +
        `If this one is genuinely justified, add it to SDK_IMPORTERS with the ` +
        `reason.`,
    ).toEqual([]);
  });

  it("cannot reach a model from any public page", () => {
    const g = graph();
    const reached = publicEntries()
      .map((e) => ({ entry: e, trail: reachesModel(g, e) }))
      .filter((r) => r.trail);

    expect(
      reached.map((r) => r.trail!.join("\n    → ")),
      `A visitor-facing route can reach ${FORBIDDEN} through these imports. ` +
        `Rendering must be a pure read of already-written Arabic.`,
    ).toEqual([]);
  });

  it("walks a believable graph", () => {
    // Without this every assertion above passes when the resolver silently
    // returns null for everything — the vacuous-pass failure that let G-14
    // scan zero files for a whole wave.
    const g = graph();
    const edges = [...g.edges.values()].reduce((n, e) => n + e.length, 0);
    expect(publicEntries().length).toBeGreaterThan(40);
    expect(edges).toBeGreaterThan(1500);
    expect(g.direct.size).toBeGreaterThan(0);
  });
});
