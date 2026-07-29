import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { SeedAgent } from "@/lib/seeds/agents";

/**
 * Advisor portraits, overlaid onto the seeded agent profiles.
 *
 * Most public surfaces render advisors from `lib/seeds/agents` — the lead
 * advisor banner, the property contact card, the valuation card, the area
 * page's advisor grid. That seed data has no photo field, so every one of
 * them drew a placeholder no matter what was uploaded in the admin; only
 * `/agents` and `/agents/[slug]`, which query `staff` directly, ever showed a
 * real portrait.
 *
 * `staff.photo_url` is the source of truth. These helpers join the two on
 * `slug` so a photo uploaded once appears everywhere that advisor does.
 */

export async function getAgentPhotos(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("staff")
      .select("slug, photo_url")
      .not("photo_url", "is", null)
      .not("slug", "is", null);
    return Object.fromEntries(
      (data ?? [])
        .filter((r) => r.slug && r.photo_url)
        .map((r) => [r.slug as string, r.photo_url as string]),
    );
  } catch (error) {
    // A failed lookup means placeholders, which is what these surfaces drew
    // before — never a broken page.
    console.error("[getAgentPhotos]", error);
    return {};
  }
}

/** Overlay a portrait onto one seeded agent. */
export async function withAgentPhoto<T extends SeedAgent>(
  agent: T | null | undefined,
): Promise<T | null> {
  if (!agent) return null;
  const photos = await getAgentPhotos();
  return { ...agent, photo_url: photos[agent.slug] ?? null };
}

/** Overlay portraits onto a list, with one lookup for the whole list. */
export async function withAgentPhotos<T extends SeedAgent>(
  agents: T[],
): Promise<T[]> {
  if (agents.length === 0) return agents;
  const photos = await getAgentPhotos();
  return agents.map((a) => ({ ...a, photo_url: photos[a.slug] ?? null }));
}
