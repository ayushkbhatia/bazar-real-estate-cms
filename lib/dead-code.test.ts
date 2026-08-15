/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * G-15 — every module is either an entry point or imported by something.
 *
 * ## Why this exists
 *
 * Waves 4b and 4c deleted **seventeen** components that nothing had ever
 * imported: seven under `tools/valuation/_components`, four under
 * `tools/compare/_components`, all six under `concierge/_components`. Not
 * abandoned — never wired. `git log --all -S` finds no commit in which any
 * file ever contained an import of them. They came in as one batch,
 * `BF-2 · backfill Sprint 5 deferrals (28 components)`, and then survived the
 * `[locale]` move and the RTL codemod, which converted their physical
 * utilities for nothing.
 *
 * That is expensive twice over. The obvious cost is dead weight. The one that
 * bites this epic is that an extraction wave cannot tell the difference: every
 * string in an unmounted component looks exactly like a string on a live page,
 * so it gets extracted, translated, human-reviewed, and added to the catalogue
 * — and then rendered nowhere. G-13's allowlist could never honestly reach
 * empty, because the files it is waiting on are files no visitor ever loads.
 *
 * ## What this does NOT do
 *
 * It does not delete anything, and it is not a list of mistakes. Ten of the
 * entries below are a deliberate parking lot, recorded in
 * `docs/FOLLOWUPS.md:962` with concrete reasons — `areas-mosaic` hardcodes
 * five areas with invented listing counts, which is a fabricated inventory
 * claim on a DLD-regulated advertising surface, and it was left out of the
 * page-builder catalogue for exactly that reason. Deleting it would destroy a
 * decision rather than dead code.
 *
 * So the list is an inventory with a reason per line. Its two jobs:
 *
 *  1. **The extraction waves skip these files.** A string here renders nowhere.
 *  2. **It may only shrink.** A new unreferenced module is either a wiring
 *     mistake caught the same day, or a deliberate park that has to be written
 *     down here to land.
 */

const REPO_ROOT = join(import.meta.dirname, "..");

/**
 * Files the framework imports rather than the codebase.
 *
 * Next.js resolves these by convention, so no `from "…"` anywhere names them
 * and every one would otherwise read as unreferenced.
 */
const ENTRY_POINT =
  /(^|\/)(page|layout|template|loading|error|not-found|global-error|global-not-found|route|default|sitemap|robots|opengraph-image|twitter-image|icon|apple-icon|manifest)\.(ts|tsx)$/;

const ROOT_ENTRY = new Set([
  "proxy.ts",
  "instrumentation.ts",
  "instrumentation-client.ts",
]);

/**
 * The modules with no importer today, and why each one is here.
 *
 * **Shrink only.** Wiring one up, or deleting it, removes a line. Adding one
 * is the thing this file exists to make deliberate.
 */
const UNREFERENCED: Readonly<Record<string, string>> = {
  // ── Deliberate: the page-builder parking lot, docs/FOLLOWUPS.md:962 ──────
  // Considered for the v1 section catalogue and left out for concrete
  // reasons. Read that entry before adopting any of them.
  "app/[locale]/(public)/_components/insights-teaser.tsx":
    "page-builder candidate; FOLLOWUPS:68 also wants the newsletter form threaded through it",
  "app/[locale]/(public)/_components/advisor-of-month.tsx":
    "page-builder candidate",
  "app/[locale]/(public)/_components/areas-mosaic.tsx":
    "page-builder candidate — hardcodes five areas with INVENTED listing counts; a fabricated inventory claim on a DLD-regulated surface",
  "app/[locale]/(public)/_components/client-words.tsx": "page-builder candidate",
  "app/[locale]/(public)/_components/awards-band.tsx": "page-builder candidate",
  "app/[locale]/(public)/_components/services-band.tsx":
    "page-builder candidate",
  "app/[locale]/(public)/_components/cta-banner.tsx":
    "page-builder candidate — imports ValuationLeadGate, so not a leaf",
  "app/[locale]/(public)/insights/[slug]/_components/article-rail.tsx":
    "FOLLOWUPS:68 names it as where the newsletter form still needs threading",

  // ── Built for the article page and never mounted ─────────────────────────
  // `insights/[slug]/page.tsx` imports none of the three. They are one line
  // from being useful, which is why they are parked rather than deleted —
  // but `namespaces.ts` cited two of them as the reason `editorial` is
  // client-global, and that reasoning was wrong (market-reports is the real
  // reason).
  "app/[locale]/(public)/insights/[slug]/_components/article-actions.tsx":
    "share/save buttons, built and never mounted on the article page",
  "app/[locale]/(public)/insights/[slug]/_components/toc.tsx":
    "article table of contents, built and never mounted",
  "app/[locale]/(public)/insights/_components/editors-pick.tsx":
    "built and never mounted on /insights",
  "app/[locale]/(public)/insights/_components/load-more.tsx":
    "built and never mounted; /insights paginates by URL instead",

  // ── Sprint 5b backfill, same batch as the seventeen already deleted ──────
  "app/[locale]/(public)/developments/[slug]/_components/location-section.tsx":
    "BF-2 backfill; the development page renders its own location band",
  "app/[locale]/(public)/developments/[slug]/_components/sticky-subnav.tsx":
    "BF-2 backfill",
  "app/[locale]/(public)/developments/[slug]/_components/advisor-section.tsx":
    "BF-2 backfill",
  "app/[locale]/(public)/_components/amenities-multi-select.tsx":
    "BF-2 backfill; MoreFiltersDrawer has its own amenities control",
  "app/[locale]/(public)/_components/card-pin-sync.tsx":
    "BF-2 backfill; a context provider nothing provides",

  // ── Orphaned by a removed feature ────────────────────────────────────────
  "lib/hooks/use-session-email.ts":
    "extracted from AccountMenu, which went with customer accounts (ADR-0005)",
  "lib/schemas/reset-password.ts":
    "the /reset-password route was removed with customer accounts (ADR-0005)",

  // ── Integration scaffolding, ahead of its wiring ─────────────────────────
  "lib/docusign.ts":
    "envelope client; lib/env.ts reserves five DOCUSIGN_* vars for it",
  "lib/schemas/license.ts": "licence CRUD, admin surface not built",
  "lib/schemas/integration.ts": "integration CRUD, admin surface not built",
  "lib/schemas/webhook.ts": "webhook CRUD, admin surface not built",
  "lib/schemas/api-key.ts": "API-key CRUD, admin surface not built",
};

/** What the inventory held when this landed. Lowering it is the point. */
const UNREFERENCED_CEILING = 24;

const EXPORTED =
  /^export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)\s+([A-Za-z0-9_]+)/gm;

/**
 * Every module, including the specs.
 *
 * A spec is not a *candidate* — nothing imports a test file and that is
 * correct — but it is very much a *referrer*. Leaving specs out of the corpus
 * reported `lib/i18n/test-utils.tsx` and `lib/i18n/fold-harness.ts` as dead,
 * when their whole purpose is to be imported by tests.
 */
function sourceFiles(): string[] {
  return execFileSync("git", ["ls-files", "app", "components", "lib"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !f.endsWith(".d.ts"));
}

/** A module that something ought to import. Specs are referrers, not these. */
function isCandidate(file: string): boolean {
  if (/\.(test|spec)\.tsx?$/.test(file)) return false;
  if (ENTRY_POINT.test(file) || ROOT_ENTRY.has(file)) return false;
  // The CMS is English permanently and is not an extraction surface, so its
  // orphans are a different conversation with a different owner.
  return !file.includes("/(admin)/");
}

/**
 * Whether any OTHER file names this module — by import specifier or by one of
 * its exported symbols.
 *
 * Two ways of asking, because either alone is wrong. A specifier match misses
 * a re-export; a symbol match alone reports a false positive whenever two
 * modules happen to export the same common name.
 */
function isReferenced(file: string, bodies: Map<string, string>): boolean {
  const src = bodies.get(file)!;
  const names = [...src.matchAll(EXPORTED)].map((m) => m[1]!);
  const withoutExt = file.replace(/\.tsx?$/, "");
  const tail = withoutExt.split("/").slice(-2).join("/");
  const stem = basename(withoutExt);

  const bySpecifier = new RegExp(
    `from\\s+["'][^"']*(?:${escape(tail)}|/${escape(stem)})["']`,
  );

  for (const [other, body] of bodies) {
    if (other === file) continue;
    if (bySpecifier.test(body)) return true;
    if (names.some((n) => new RegExp(`\\b${escape(n)}\\b`).test(body))) {
      return true;
    }
  }
  return false;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unreferencedNow(): string[] {
  const files = sourceFiles();
  const bodies = new Map(
    files.map((f) => [f, readFileSync(join(REPO_ROOT, f), "utf8")] as const),
  );

  const out: string[] = [];
  for (const file of files) {
    if (!isCandidate(file)) continue;
    if (!EXPORTED.test(bodies.get(file)!)) continue;
    EXPORTED.lastIndex = 0;
    if (!isReferenced(file, bodies)) out.push(file);
  }
  return out.sort();
}

describe("G-15 · no new unreferenced modules", () => {
  it("finds none outside the inventory", () => {
    const surprises = unreferencedNow().filter((f) => !(f in UNREFERENCED));

    expect(
      surprises,
      `These modules are imported by nothing:\n${surprises.join("\n")}\n\n` +
        `Either wire them up, delete them, or — if the park is deliberate — ` +
        `add a line to UNREFERENCED in lib/dead-code.test.ts saying WHY, and ` +
        `raise UNREFERENCED_CEILING.\n\n` +
        `This matters to the message waves specifically: a string in a ` +
        `component nothing mounts still gets extracted, translated and ` +
        `reviewed, and then renders nowhere. Seventeen such components were ` +
        `deleted in waves 4b and 4c.`,
    ).toEqual([]);
  });

  it("keeps the inventory honest", () => {
    // An entry that IS referenced now is a component someone wired up and
    // forgot to delist. Harmless, but it hides progress and makes the ceiling
    // mean less than it says.
    const now = new Set(unreferencedNow());
    const stale = Object.keys(UNREFERENCED).filter((f) => !now.has(f));

    expect(
      stale.sort(),
      `These are referenced now — remove them from UNREFERENCED and lower ` +
        `UNREFERENCED_CEILING:\n${stale.sort().join("\n")}`,
    ).toEqual([]);
  });

  it("only ever lets the inventory shrink", () => {
    expect(Object.keys(UNREFERENCED).length).toBeLessThanOrEqual(
      UNREFERENCED_CEILING,
    );
  });

  it("scans a believable number of files", () => {
    // Guards against the glob matching nothing, which would make every
    // assertion above vacuously true — the failure mode that made G-14 pass
    // for a whole wave while scanning zero files under app/[locale].
    expect(sourceFiles().length).toBeGreaterThan(450);
  });
});

/**
 * The list the extraction waves read.
 *
 * Exported so a wave can assert it skipped these rather than remembering to.
 */
export const UNRENDERED_MODULES = Object.keys(UNREFERENCED);
