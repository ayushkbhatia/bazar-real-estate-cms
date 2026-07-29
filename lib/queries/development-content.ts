import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { SEED_AGENTS, type SeedAgent } from "@/lib/seeds/agents";
import type { DevelopmentIndexRow } from "@/lib/queries/developments";

/**
 * Reads for the parts of a project page an editor curates on the record:
 * the neighbouring projects it points at, and the advisor in its banner.
 */

const NEIGHBOUR_FIELDS =
  "id, name, slug, status, handover_date, total_units, starting_price, tagline, bedrooms_text, description, published_at, developers:developer_id(name, slug), areas:area_id(name, slug), hero:hero_image_id(storage_key, filename, alt_text)";

/**
 * Curated neighbours, in the order they were picked.
 *
 * Unpublished or deleted picks simply don't come back, so a project that was
 * pulled from the site stops appearing next to its neighbours rather than
 * rendering a card that leads nowhere.
 */
export async function listDevelopmentsByIds(
  ids: string[],
): Promise<DevelopmentIndexRow[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("developments")
      .select(NEIGHBOUR_FIELDS)
      .in("id", ids.slice(0, 3))
      .not("published_at", "is", null);
    if (error || !data) return [];

    const rows = data as unknown as DevelopmentIndexRow[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is DevelopmentIndexRow => r !== undefined);
  } catch (error) {
    console.error("[listDevelopmentsByIds]", error);
    return [];
  }
}

/**
 * The advisor chosen for a project's banner, shaped like the seeded agents the
 * banner already renders. Falls back to null so the caller keeps its
 * by-area default — a staff member who's since gone inactive shouldn't leave
 * the banner blank.
 */
export async function getAdvisorForBanner(
  userId: string,
): Promise<SeedAgent | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("staff")
      .select("user_id, display_name, slug, title, brn, bio, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!data) return null;

    // Contact details still come from the seeded profile when there's a match
    // on slug — `staff` doesn't carry phone/WhatsApp yet.
    const seed = SEED_AGENTS.find((a) => a.slug === data.slug);
    return {
      ...(seed ?? SEED_AGENTS[0]),
      slug: data.slug ?? seed?.slug ?? "",
      display_name: data.display_name,
      title: data.title ?? seed?.title ?? "Advisor",
      brn: data.brn ?? seed?.brn ?? "",
      bio: data.bio ?? seed?.bio ?? "",
    };
  } catch (error) {
    console.error("[getAdvisorForBanner]", error);
    return null;
  }
}

/**
 * Resolve the media ids on curated feature blocks into public URLs. One query
 * for the whole page; a block whose asset has been trashed falls back to the
 * placeholder rather than rendering a broken image.
 */
export async function withFeatureImages(
  blocks: { media_id?: string | null }[] | undefined,
): Promise<Record<string, string>> {
  const ids = [...new Set((blocks ?? []).map((b) => b.media_id).filter(Boolean))];
  if (!isSupabaseConfigured || ids.length === 0) return {};
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("media_assets")
      .select("id, storage_key")
      .in("id", ids as string[])
      .is("deleted_at", null);
    return Object.fromEntries(
      (data ?? []).map((m) => [m.id, mediaPublicUrl(m.storage_key)]),
    );
  } catch (error) {
    console.error("[withFeatureImages]", error);
    return {};
  }
}
