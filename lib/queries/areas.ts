import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";

export type AreaOption = {
  id: string;
  slug: string;
  name: string;
};

/** Top-level Abu Dhabi areas used in tools and forms (not the full tree). */
export async function listAreaOptions(): Promise<AreaOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, slug, name, kind")
    .eq("kind", "area")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, slug: r.slug, name: r.name }));
}

/** Look up an area's slug given its id. Returns null if missing. */
export async function getAreaSlugById(id: string): Promise<string | null> {
  if (!isSupabaseConfigured || !id) return null;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("areas")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  return data?.slug ?? null;
}
