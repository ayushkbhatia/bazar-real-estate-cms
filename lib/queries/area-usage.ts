import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  EMPTY_AREA_USAGE,
  type AreaUsage,
  type AreaUsageGroup,
} from "@/lib/area-usage";

const SAMPLE = 5;

/** The three columns that place a listing in an area. */
const PROPERTY_AREA_COLUMNS = ["area_id", "sub_community_id", "building_id"];

/**
 * In the area by any column, and not live (unpublished, or soft-deleted): the
 * product written out as one `or` of `and` pairs.
 */
function notLiveInAreaFilter(areaId: string): string {
  return PROPERTY_AREA_COLUMNS.flatMap((c) => [
    `and(${c}.eq.${areaId},status.neq.published)`,
    `and(${c}.eq.${areaId},deleted_at.not.is.null)`,
  ]).join(",");
}

/**
 * Every unpublished listing and project a delete would leave without an area
 * (0170 detaches them) — ids only, for the audit entry, so each can be found
 * and placed again.
 */
export async function getUnpublishedInArea(
  areaId: string,
): Promise<{ properties: string[]; developments: string[] }> {
  if (!isSupabaseConfigured) return { properties: [], developments: [] };
  const supabase = await createSupabaseServerClient();
  const [properties, developments] = await Promise.all([
    supabase
      .from("properties")
      .select("id")
      .or(notLiveInAreaFilter(areaId))
      .order("id"),
    supabase
      .from("developments")
      .select("id")
      .eq("area_id", areaId)
      .is("published_at", null)
      .order("id"),
  ]);
  return {
    properties: (properties.data ?? []).map((r) => r.id),
    developments: (developments.data ?? []).map((r) => r.id),
  };
}

/**
 * Read with the signed-in staff member's session. Admin and editor — the
 * roles that may delete — read every listing and project, so the counts are
 * whole for them; for anyone else the database trigger still has the last word.
 *
 * Live means what the public RLS policies let anyone read: a listing that is
 * published and not soft-deleted, a project with `published_at` set. Those
 * block; the rest are counted apart as `unpublished`.
 */
export async function getAreaUsage(area: {
  id: string;
  slug: string;
}): Promise<AreaUsage> {
  if (!isSupabaseConfigured) return EMPTY_AREA_USAGE;
  const supabase = await createSupabaseServerClient();
  const href = `%/areas/${area.slug}`;
  const inArea = PROPERTY_AREA_COLUMNS.map((c) => `${c}.eq.${area.id}`).join(",");
  const notLiveInArea = notLiveInAreaFilter(area.id);

  const [
    properties,
    developments,
    children,
    unpublishedProperties,
    unpublishedDevelopments,
    megamenu,
    tiles,
    footer,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, title, reference", { count: "exact" })
      .or(inArea)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("title", { ascending: true })
      .limit(SAMPLE),
    supabase
      .from("developments")
      .select("id, name", { count: "exact" })
      .eq("area_id", area.id)
      .not("published_at", "is", null)
      .order("name", { ascending: true })
      .limit(SAMPLE),
    supabase
      .from("areas")
      .select("id, name", { count: "exact" })
      .eq("parent_id", area.id)
      .order("name", { ascending: true })
      .limit(SAMPLE),
    supabase
      .from("properties")
      .select("id, title, reference", { count: "exact" })
      .or(notLiveInArea)
      .order("title", { ascending: true })
      .limit(SAMPLE),
    supabase
      .from("developments")
      .select("id, name", { count: "exact" })
      .eq("area_id", area.id)
      .is("published_at", null)
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
    properties: propertyGroup(properties),
    developments: developmentGroup(developments),
    children: {
      count: children.count ?? 0,
      sample: (children.data ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        href: `/admin/areas/${c.id}`,
      })),
    },
    unpublished: {
      properties: propertyGroup(unpublishedProperties),
      developments: developmentGroup(unpublishedDevelopments),
    },
    menuLinks: (megamenu.count ?? 0) + (tiles.count ?? 0) + (footer.count ?? 0),
  };
}

function propertyGroup(result: {
  count: number | null;
  data: { id: string; title: string; reference: string }[] | null;
}): AreaUsageGroup {
  return {
    count: result.count ?? 0,
    sample: (result.data ?? []).map((p) => ({
      id: p.id,
      label: `${p.title} · ${p.reference}`,
      href: `/admin/properties/${p.id}`,
    })),
  };
}

function developmentGroup(result: {
  count: number | null;
  data: { id: string; name: string }[] | null;
}): AreaUsageGroup {
  return {
    count: result.count ?? 0,
    sample: (result.data ?? []).map((d) => ({
      id: d.id,
      label: d.name,
      href: `/admin/developments/${d.id}`,
    })),
  };
}
