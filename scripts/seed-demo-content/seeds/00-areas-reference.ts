import { adminClient } from "../lib/client.ts";
import { log } from "../lib/log.ts";

/**
 * Reads the existing areas + developers + developments + agents so other
 * seeders can reference them by slug. Doesn't mutate anything; pure lookup.
 *
 * Agents are preloaded here too (alongside areas/devs) so a seeder that
 * runs in isolation (e.g. SEED_ONLY=articles) can still resolve
 * author_slug → user_id without first re-running the agents seeder.
 */
export type Reference = {
  areaIdBySlug: Map<string, string>;
  developerIdBySlug: Map<string, string>;
  developmentIdBySlug: Map<string, string>;
  agentIdBySlug: Map<string, string>;
};

export async function loadReference(): Promise<Reference> {
  const supabase = adminClient();
  log.step("Loading reference data (areas / developers / developments / agents)");

  const [areas, developers, developments, agents] = await Promise.all([
    supabase.from("areas").select("id, slug"),
    supabase.from("developers").select("id, slug"),
    supabase.from("developments").select("id, slug"),
    supabase.from("staff").select("user_id, slug").eq("role", "agent"),
  ]);

  if (areas.error) throw new Error(`areas: ${areas.error.message}`);
  if (developers.error) throw new Error(`developers: ${developers.error.message}`);
  if (developments.error) throw new Error(`developments: ${developments.error.message}`);
  if (agents.error) throw new Error(`agents: ${agents.error.message}`);

  const ref: Reference = {
    areaIdBySlug: new Map((areas.data ?? []).map((r) => [r.slug, r.id])),
    developerIdBySlug: new Map((developers.data ?? []).map((r) => [r.slug, r.id])),
    developmentIdBySlug: new Map((developments.data ?? []).map((r) => [r.slug, r.id])),
    agentIdBySlug: new Map((agents.data ?? []).map((r) => [r.slug, r.user_id])),
  };

  log.ok(
    `${ref.areaIdBySlug.size} areas, ${ref.developerIdBySlug.size} developers, ${ref.developmentIdBySlug.size} developments, ${ref.agentIdBySlug.size} agents`,
  );
  return ref;
}

/** Throw with a helpful message if a referenced slug is missing. */
export function resolveAreaId(ref: Reference, slug: string): string {
  const id = ref.areaIdBySlug.get(slug);
  if (!id) throw new Error(`Unknown area slug: ${slug}. Known: ${[...ref.areaIdBySlug.keys()].join(", ")}`);
  return id;
}

export function resolveDevelopmentId(ref: Reference, slug: string): string {
  const id = ref.developmentIdBySlug.get(slug);
  if (!id) throw new Error(`Unknown development slug: ${slug}. Known: ${[...ref.developmentIdBySlug.keys()].join(", ")}`);
  return id;
}
