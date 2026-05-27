/**
 * scripts/seed-demo-content/index.ts
 *
 * One-shot seeder that fills the public marketplace with curated demo
 * content for the client handover. Idempotent: every insert uses
 * onConflict so re-running converges on the same target state.
 *
 * Run:   npm run seed:demo
 * Or:    node --env-file=.env.local scripts/seed-demo-content/index.ts
 *
 * Flags (set via env):
 *   SEED_ONLY=agents,articles    only run these seed modules
 *   SEED_SKIP=properties,media   skip these seed modules
 *   SEED_DRY_RUN=1               read-only; no writes (where supported)
 *
 * Seed order matters — properties reference agents, media references
 * properties. Don't reorder without thinking it through.
 */
import { log } from "./lib/log.ts";
import { loadReference } from "./seeds/00-areas-reference.ts";
import { runAgents } from "./seeds/01-agents.ts";
import { runArticles } from "./seeds/02-articles.ts";
import { runProperties } from "./seeds/03-properties.ts";
import { runReviews } from "./seeds/04-reviews.ts";

type SeedModule = {
  name: string;
  run: (ctx: SeedContext) => Promise<void>;
};

export type SeedContext = {
  ref: Awaited<ReturnType<typeof loadReference>>;
  agents: Map<string, string>; // slug → user_id, populated by agents seeder
};

const MODULES: SeedModule[] = [
  { name: "agents", run: runAgents },
  { name: "articles", run: runArticles },
  { name: "properties", run: runProperties },
  { name: "reviews", run: runReviews },
  // additional modules wired in as they land:
  // { name: "properties", run: runProperties },
  // { name: "media", run: runMedia },
  // { name: "reviews", run: runReviews },
];

function parseList(name: string): Set<string> | null {
  const raw = process.env[name];
  if (!raw) return null;
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

async function main(): Promise<void> {
  const only = parseList("SEED_ONLY");
  const skip = parseList("SEED_SKIP") ?? new Set<string>();
  const dryRun = process.env.SEED_DRY_RUN === "1";

  log.step("Bazar demo-content seeder");
  if (dryRun) log.warn("SEED_DRY_RUN=1 — modules that support it will read-only");
  if (only) log.dim(`SEED_ONLY=${[...only].join(",")}`);
  if (skip.size) log.dim(`SEED_SKIP=${[...skip].join(",")}`);

  const ref = await loadReference();
  // Pre-populate ctx.agents from DB so a seeder run in isolation
  // (SEED_ONLY=articles) can resolve author_slug → user_id.
  const ctx: SeedContext = { ref, agents: new Map(ref.agentIdBySlug) };

  for (const mod of MODULES) {
    if (only && !only.has(mod.name)) {
      log.dim(`skip ${mod.name} (not in SEED_ONLY)`);
      continue;
    }
    if (skip.has(mod.name)) {
      log.dim(`skip ${mod.name} (in SEED_SKIP)`);
      continue;
    }
    await mod.run(ctx);
  }

  log.step("Done");
}

main().catch((err) => {
  console.error("\n✗ Seeder failed:");
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
