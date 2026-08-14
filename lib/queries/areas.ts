import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";

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
    .select("id, slug, name, name_ar, kind")
    .eq("kind", "area")
    .order("name", { ascending: true });
  if (error || !data) return [];
  const locale = await currentLocale();
  // The label is display; `id` and `slug` are identity and stay English —
  // the form submits the id, so folding the label cannot break the value.
  return data.map((r) => {
    const t = localiseRow(r as unknown as Record<string, unknown>, locale) as {
      id: string;
      slug: string;
      name: string;
    };
    return { id: r.id, slug: r.slug, name: t.name };
  });
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
