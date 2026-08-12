import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import type {
  Megamenu,
  MegamenuColumn,
  MegamenuFeaturedTile,
  MegamenuItem,
  MegamenuTab,
} from "@/lib/schemas/megamenu";

/**
 * Server-side reads for the CMS-editable megamenu.
 *
 * Public render path (used in app/[locale]/(public)/layout.tsx):
 *   `getPublishedMegamenu()` — cookie-free, RLS reads only `status='published'`
 *   tabs and their children. Falls back to an empty menu if Supabase env is
 *   missing, so previews and offline dev still render the rest of the page.
 *
 * Admin paths (used in app/[locale]/(admin)/admin/navigation/*):
 *   `listMegamenuTabsForAdmin()`   — sidebar list (all tabs, any status)
 *   `getMegamenuTabBySlugForAdmin(slug)` — full tab tree for the editor
 */

// ───────────────────────────────────────────────────────────────
// Shared shape-builder
// ───────────────────────────────────────────────────────────────
type RawTab = {
  id: string;
  slug: string;
  label: string;
  href: string | null;
  has_panel: boolean;
  position: number;
  panel_title: string | null;
  panel_title_href: string | null;
  right_column_title: string | null;
  status: "draft" | "published";
};
type RawColumn = {
  id: string;
  tab_id: string;
  zone: "left" | "right";
  position: number;
  heading: string | null;
};
type RawItem = {
  id: string;
  column_id: string;
  position: number;
  label: string;
  href: string;
  target_kind: MegamenuItem["target_kind"];
  target_id: string | null;
  icon: string | null;
  badge_label: string | null;
  badge_variant: MegamenuItem["badge_variant"];
};
type RawTile = {
  id: string;
  tab_id: string;
  position: number;
  variant: MegamenuFeaturedTile["variant"];
  badge_label: string | null;
  badge_kind: MegamenuFeaturedTile["badge_kind"];
  headline: string;
  href: string;
  media_asset_id: string | null;
  /** Public URL for `media_asset_id`, resolved at read time. Never stored. */
  media_url?: string | null;
  media?: { storage_key: string; deleted_at: string | null } | null;
  cta_label: string | null;
};

function buildMegamenu(
  tabs: RawTab[],
  columns: RawColumn[],
  items: RawItem[],
  tiles: RawTile[],
): Megamenu {
  // Index items by column for O(1) attach.
  const itemsByColumn = new Map<string, RawItem[]>();
  for (const it of items) {
    const arr = itemsByColumn.get(it.column_id) ?? [];
    arr.push(it);
    itemsByColumn.set(it.column_id, arr);
  }

  // Index columns by tab + zone.
  const columnsByTabZone = new Map<string, RawColumn[]>();
  for (const c of columns) {
    const key = `${c.tab_id}::${c.zone}`;
    const arr = columnsByTabZone.get(key) ?? [];
    arr.push(c);
    columnsByTabZone.set(key, arr);
  }

  // Index tiles by tab.
  const tilesByTab = new Map<string, RawTile[]>();
  for (const t of tiles) {
    const arr = tilesByTab.get(t.tab_id) ?? [];
    arr.push(t);
    tilesByTab.set(t.tab_id, arr);
  }

  const shapedTabs: MegamenuTab[] = tabs.map((t) => {
    const left = (columnsByTabZone.get(`${t.id}::left`) ?? [])
      .sort((a, b) => a.position - b.position)
      .map<MegamenuColumn>((c) => ({
        id: c.id,
        zone: "left",
        position: c.position,
        heading: c.heading,
        items: (itemsByColumn.get(c.id) ?? [])
          .sort((a, b) => a.position - b.position)
          .map<MegamenuItem>((i) => ({
            id: i.id,
            position: i.position,
            label: i.label,
            href: i.href,
            target_kind: i.target_kind,
            target_id: i.target_id,
            icon: i.icon,
            badge_label: i.badge_label,
            badge_variant: i.badge_variant,
          })),
      }));
    const right = (columnsByTabZone.get(`${t.id}::right`) ?? [])
      .sort((a, b) => a.position - b.position)
      .map<MegamenuColumn>((c) => ({
        id: c.id,
        zone: "right",
        position: c.position,
        heading: c.heading,
        items: (itemsByColumn.get(c.id) ?? [])
          .sort((a, b) => a.position - b.position)
          .map<MegamenuItem>((i) => ({
            id: i.id,
            position: i.position,
            label: i.label,
            href: i.href,
            target_kind: i.target_kind,
            target_id: i.target_id,
            icon: i.icon,
            badge_label: i.badge_label,
            badge_variant: i.badge_variant,
          })),
      }));
    const featured = (tilesByTab.get(t.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map<MegamenuFeaturedTile>((tl) => ({
        id: tl.id,
        position: tl.position,
        variant: tl.variant,
        badge_label: tl.badge_label,
        badge_kind: tl.badge_kind,
        headline: tl.headline,
        href: tl.href,
        media_asset_id: tl.media_asset_id,
        // A trashed asset falls back to the placeholder rather than 404-ing.
        media_url:
          tl.media && !tl.media.deleted_at
            ? mediaPublicUrl(tl.media.storage_key)
            : null,
        cta_label: tl.cta_label,
      }));
    return {
      id: t.id,
      slug: t.slug,
      label: t.label,
      href: t.href,
      has_panel: t.has_panel,
      position: t.position,
      panel_title: t.panel_title,
      panel_title_href: t.panel_title_href,
      right_column_title: t.right_column_title,
      status: t.status,
      columns: { left, right },
      featured,
    };
  });

  shapedTabs.sort((a, b) => a.position - b.position);
  return { tabs: shapedTabs };
}

const EMPTY: Megamenu = { tabs: [] };

// ───────────────────────────────────────────────────────────────
// Public read — used by the public layout. SSG-friendly.
// ───────────────────────────────────────────────────────────────
export async function getPublishedMegamenu(): Promise<Megamenu> {
  if (!isSupabaseConfigured) return EMPTY;
  try {
    const supabase = createSupabasePublicClient();
    const [tabsRes, columnsRes, itemsRes, tilesRes] = await Promise.all([
      supabase
        .from("megamenu_tabs")
        .select(
          "id, slug, label, href, has_panel, position, panel_title, panel_title_href, right_column_title, status",
        )
        .eq("status", "published")
        .order("position"),
      supabase
        .from("megamenu_columns")
        .select("id, tab_id, zone, position, heading"),
      supabase
        .from("megamenu_items")
        .select(
          "id, column_id, position, label, href, target_kind, target_id, icon, badge_label, badge_variant",
        ),
      supabase
        .from("megamenu_featured_tiles")
        .select(
          "id, tab_id, position, variant, badge_label, badge_kind, headline, href, media_asset_id, cta_label, media:media_asset_id(storage_key, deleted_at)",
        ),
    ]);

    if (tabsRes.error) {
      console.error("[getPublishedMegamenu] tabs", tabsRes.error);
      return EMPTY;
    }
    return buildMegamenu(
      (tabsRes.data ?? []) as RawTab[],
      (columnsRes.data ?? []) as RawColumn[],
      (itemsRes.data ?? []) as RawItem[],
      (tilesRes.data ?? []) as RawTile[],
    );
  } catch (e) {
    console.error("[getPublishedMegamenu]", e);
    return EMPTY;
  }
}

// ───────────────────────────────────────────────────────────────
// Admin reads — full visibility including drafts.
// ───────────────────────────────────────────────────────────────
export type MegamenuTabListRow = {
  id: string;
  slug: string;
  label: string;
  has_panel: boolean;
  position: number;
  status: "draft" | "published";
  updated_at: string;
};

export async function listMegamenuTabsForAdmin(): Promise<MegamenuTabListRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("megamenu_tabs")
    .select("id, slug, label, has_panel, position, status, updated_at")
    .order("position");
  if (error) {
    console.error("[listMegamenuTabsForAdmin]", error);
    return [];
  }
  return (data ?? []) as MegamenuTabListRow[];
}

export async function getMegamenuTabBySlugForAdmin(
  slug: string,
): Promise<MegamenuTab | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();

  const { data: tab, error: tabErr } = await supabase
    .from("megamenu_tabs")
    .select(
      "id, slug, label, href, has_panel, position, panel_title, panel_title_href, right_column_title, status",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (tabErr || !tab) {
    if (tabErr) console.error("[getMegamenuTabBySlugForAdmin] tab", tabErr);
    return null;
  }

  const [columnsRes, tilesRes] = await Promise.all([
    supabase
      .from("megamenu_columns")
      .select("id, tab_id, zone, position, heading")
      .eq("tab_id", tab.id),
    supabase
      .from("megamenu_featured_tiles")
      .select(
        "id, tab_id, position, variant, badge_label, badge_kind, headline, href, media_asset_id, cta_label, media:media_asset_id(storage_key, deleted_at)",
      )
      .eq("tab_id", tab.id),
  ]);
  const columns = (columnsRes.data ?? []) as RawColumn[];
  const tiles = (tilesRes.data ?? []) as RawTile[];

  // Fetch all items for these columns in one round-trip.
  const columnIds = columns.map((c) => c.id);
  let items: RawItem[] = [];
  if (columnIds.length > 0) {
    const { data, error } = await supabase
      .from("megamenu_items")
      .select(
        "id, column_id, position, label, href, target_kind, target_id, icon, badge_label, badge_variant",
      )
      .in("column_id", columnIds);
    if (error) {
      console.error("[getMegamenuTabBySlugForAdmin] items", error);
    } else {
      items = (data ?? []) as RawItem[];
    }
  }

  const shaped = buildMegamenu([tab as RawTab], columns, items, tiles);
  return shaped.tabs[0] ?? null;
}

/** Sidebar URL for a megamenu tab editor screen. */
export function megamenuTabAdminUrl(slug: string): string {
  return `/admin/navigation/${slug}`;
}
