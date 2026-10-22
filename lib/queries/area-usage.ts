import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { EMPTY_AREA_USAGE, type AreaUsage } from "@/lib/area-usage";

const SAMPLE = 5;

/**
 * Read with the signed-in staff member's session. Admin and editor — the
 * roles that may delete — read every listing and project, so the counts are
 * whole for them; for anyone else the database trigger still has the last word.
 */
export async function getAreaUsage(area: {
  id: string;
  slug: string;
}): Promise<AreaUsage> {
  if (!isSupabaseConfigured) return EMPTY_AREA_USAGE;
  const supabase = await createSupabaseServerClient();
  const href = `%/areas/${area.slug}`;

  const [properties, developments, children, megamenu, tiles, footer] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, title, reference", { count: "exact" })
        .or(
          `area_id.eq.${area.id},sub_community_id.eq.${area.id},building_id.eq.${area.id}`,
        )
        .order("title", { ascending: true })
        .limit(SAMPLE),
      supabase
        .from("developments")
        .select("id, name", { count: "exact" })
        .eq("area_id", area.id)
        .order("name", { ascending: true })
        .limit(SAMPLE),
      supabase
        .from("areas")
        .select("id, name", { count: "exact" })
        .eq("parent_id", area.id)
        .order("name", { ascending: true })
        .limit(SAMPLE),
      supabase
        .from("megamenu_items")
        .select("id", { count: "exact", head: true })
        .like("href", href),
      supabase
        .from("megamenu_featured_tiles")
        .select("id", { count: "exact", head: true })
        .like("href", href),
      supabase
        .from("footer_links")
        .select("id", { count: "exact", head: true })
        .like("href", href),
    ]);

  return {
    properties: {
      count: properties.count ?? 0,
      sample: (properties.data ?? []).map((p) => ({
        id: p.id,
        label: `${p.title} · ${p.reference}`,
        href: `/admin/properties/${p.id}`,
      })),
    },
    developments: {
      count: developments.count ?? 0,
      sample: (developments.data ?? []).map((d) => ({
        id: d.id,
        label: d.name,
        href: `/admin/developments/${d.id}`,
      })),
    },
    children: {
      count: children.count ?? 0,
      sample: (children.data ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        href: `/admin/areas/${c.id}`,
      })),
    },
    menuLinks: (megamenu.count ?? 0) + (tiles.count ?? 0) + (footer.count ?? 0),
  };
}
