"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  tabEditPayloadSchema,
  type TabEditPayload,
} from "@/lib/schemas/megamenu";

const MEGAMENU_ROLES = ["admin", "editor", "marketing"] as const;

export type SaveMegamenuTabResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export type PublishMegamenuTabResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Replace-then-insert pattern for saving a tab.
 *
 * Why replace (not diff): the editor sends the full state of columns +
 * items + tiles on every save. Deleting and re-inserting is simpler than
 * tracking which rows are new/updated/removed, the row counts are small
 * (<50), and `on delete cascade` cleans up child rows in a single round
 * trip. The cost is that IDs change on every save — fine because nothing
 * outside the megamenu references those IDs.
 */
async function revalidateMegamenuPaths() {
  if (!isSupabaseConfigured) return;
  revalidatePath("/admin/navigation");
  revalidateLocalised("/", "layout"); // every public page renders the nav
}

export async function saveMegamenuTab(
  tabId: string,
  rawPayload: unknown,
): Promise<SaveMegamenuTabResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEGAMENU_ROLES);

  const parsed = tabEditPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path.slice(0, 2).join(".") || issue.path[0] || "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const payload: TabEditPayload = parsed.data;
  const supabase = await createSupabaseServerClient();

  // 1) Update tab metadata.
  const { error: metaErr } = await supabase
    .from("megamenu_tabs")
    .update({
      label: payload.meta.label,
      href: payload.meta.href ?? null,
      has_panel: payload.meta.has_panel,
      panel_title: payload.meta.panel_title ?? null,
      panel_title_href: payload.meta.panel_title_href ?? null,
      right_column_title: payload.meta.right_column_title ?? null,
    })
    .eq("id", tabId);
  if (metaErr) return { status: "error", message: metaErr.message };

  // 2) Wipe columns (items cascade) + tiles for this tab.
  const [{ error: delCols }, { error: delTiles }] = await Promise.all([
    supabase.from("megamenu_columns").delete().eq("tab_id", tabId),
    supabase.from("megamenu_featured_tiles").delete().eq("tab_id", tabId),
  ]);
  if (delCols) return { status: "error", message: delCols.message };
  if (delTiles) return { status: "error", message: delTiles.message };

  // 3) Insert columns. Re-number positions sequentially so the source of
  //    truth is the array order, not the client's "position" field.
  if (payload.columns.length > 0) {
    const colRows = payload.columns.map((c, idx) => ({
      tab_id: tabId,
      zone: c.zone,
      position: idx, // overwrite client position — array order is canonical
      heading: c.heading ?? null,
    }));
    const { data: insertedCols, error: insColsErr } = await supabase
      .from("megamenu_columns")
      .insert(colRows)
      .select("id, zone, position");
    if (insColsErr) return { status: "error", message: insColsErr.message };

    // 4) Map inserted columns back to payload entries so items get the
    //    right column_id. We rely on (zone, position) pairs being unique
    //    within a tab (true by construction since we just numbered them).
    const colIdByKey = new Map<string, string>();
    for (const r of insertedCols ?? []) {
      colIdByKey.set(`${r.zone}::${r.position}`, r.id);
    }

    // 5) Insert items, scoped to their parent column.
    const itemRows: {
      column_id: string;
      position: number;
      label: string;
      href: string;
      target_kind: TabEditPayload["columns"][number]["items"][number]["target_kind"];
      target_id: string | null;
      icon: string | null;
      badge_label: string | null;
      badge_variant: TabEditPayload["columns"][number]["items"][number]["badge_variant"];
    }[] = [];

    payload.columns.forEach((col, colIdx) => {
      const columnId = colIdByKey.get(`${col.zone}::${colIdx}`);
      if (!columnId) return;
      col.items.forEach((it, itemIdx) => {
        itemRows.push({
          column_id: columnId,
          position: itemIdx,
          label: it.label,
          href: it.href,
          target_kind: it.target_kind ?? null,
          target_id: it.target_id ?? null,
          icon: it.icon ?? null,
          badge_label: it.badge_label ?? null,
          badge_variant: it.badge_variant ?? "default",
        });
      });
    });

    if (itemRows.length > 0) {
      const { error: insItemsErr } = await supabase
        .from("megamenu_items")
        .insert(itemRows);
      if (insItemsErr)
        return { status: "error", message: insItemsErr.message };
    }
  }

  // 6) Insert featured tiles.
  if (payload.featured.length > 0) {
    const tileRows = payload.featured.map((t, idx) => ({
      tab_id: tabId,
      position: idx,
      variant: t.variant ?? "dark",
      badge_label: t.badge_label ?? null,
      badge_kind: t.badge_kind ?? "dot",
      headline: t.headline,
      href: t.href,
      media_asset_id: t.media_asset_id ?? null,
      cta_label: t.cta_label ?? null,
    }));
    const { error: insTilesErr } = await supabase
      .from("megamenu_featured_tiles")
      .insert(tileRows);
    if (insTilesErr)
      return { status: "error", message: insTilesErr.message };
  }

  await logAudit({
    action: "megamenu.tab.save",
    target_kind: "page", // closest existing audit target kind
    target_id: tabId,
    before: null,
    after: { label: payload.meta.label, columns: payload.columns.length, featured: payload.featured.length },
  });

  await revalidateMegamenuPaths();
  return { status: "ok", message: "Saved." };
}

export async function publishMegamenuTab(
  tabId: string,
): Promise<PublishMegamenuTabResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEGAMENU_ROLES);

  const supabase = await createSupabaseServerClient();

  // Soft publishability gate: a panel tab needs at least one column.
  const { data: tab } = await supabase
    .from("megamenu_tabs")
    .select("has_panel, label, status")
    .eq("id", tabId)
    .maybeSingle();
  if (!tab) return { status: "error", message: "Tab not found." };

  if (tab.has_panel) {
    const { count } = await supabase
      .from("megamenu_columns")
      .select("id", { count: "exact", head: true })
      .eq("tab_id", tabId);
    if ((count ?? 0) === 0) {
      return {
        status: "error",
        message: "Add at least one column before publishing.",
      };
    }
  }

  const { error } = await supabase
    .from("megamenu_tabs")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", tabId);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "megamenu.tab.publish",
    target_kind: "page",
    target_id: tabId,
    before: { status: tab.status },
    after: { status: "published" },
  });

  await revalidateMegamenuPaths();
  return { status: "ok", message: "Published." };
}

export async function unpublishMegamenuTab(
  tabId: string,
): Promise<PublishMegamenuTabResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEGAMENU_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data: tab } = await supabase
    .from("megamenu_tabs")
    .select("status")
    .eq("id", tabId)
    .maybeSingle();
  if (!tab) return { status: "error", message: "Tab not found." };

  const { error } = await supabase
    .from("megamenu_tabs")
    .update({ status: "draft" })
    .eq("id", tabId);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "megamenu.tab.unpublish",
    target_kind: "page",
    target_id: tabId,
    before: { status: tab.status },
    after: { status: "draft" },
  });

  await revalidateMegamenuPaths();
  return { status: "ok", message: "Reverted to draft." };
}
