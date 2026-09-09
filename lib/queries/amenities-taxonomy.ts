/**
 * Amenity taxonomy — the canonical vocabulary backing the amenities picker on
 * the property and development editors (Sprint 7c/8) and the search facet
 * (Sprint 4b). Falls back to DEFAULT_AMENITIES from the schema when Supabase
 * is offline or the table is empty.
 *
 * ── Why there is no `localiseDeep` here ──────────────────────────────────
 * There used to be, and it was the bug. `properties.amenities` stores English
 * LABELS, and every consumer joins a stored value back to this list by that
 * label — so folding `label` to Arabic on `/ar` did not translate the grid, it
 * broke the join: nothing matched, `amenityLabel()` returned its own input,
 * and the property page printed English inside an otherwise Arabic page. Worse
 * in the CMS, where the same folded list drives the picker: a save made from
 * `/ar/admin/...` would have written Arabic into a column of English labels.
 *
 * So `label` never folds. It is an identity as much as a word. The Arabic
 * rides alongside in `label_ar` and the renderer picks — the shape
 * `MoreFiltersDrawer` has used since the facet shipped, now shared by the
 * whole read path.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { arabicFor } from "@/lib/i18n/arabic-store";
import {
  DEFAULT_AMENITIES,
  type AmenityTaxonomyEntry,
} from "@/lib/schemas/amenity-taxonomy";
import type { AmenityTaxonomyRow } from "@/lib/types/sprint-8";

/**
 * Row → entry, with the store standing in for an untranslated twin.
 *
 * The fallback is the same one `localiseRow` reaches for on a blank twin, and
 * it matters more here than most: the taxonomy the client actually uses is 87
 * rows that arrived by migration long after the 21 seeded in code, and every
 * one of them shipped with `label_ar` null. Reading through the store means
 * `/ar` renders Arabic for them without waiting on the CMS pass — and the CMS
 * pass still wins the moment anyone types into a row, because a stored twin is
 * checked first.
 */
function toEntry(row: AmenityTaxonomyRow): AmenityTaxonomyEntry {
  return {
    code: row.code,
    label: row.label,
    label_ar: row.label_ar?.trim() ? row.label_ar : (arabicFor(row.label) ?? null),
    category: row.category,
    icon: row.icon,
    sort_order: row.sort_order,
    active: row.active,
  };
}

/** Sorted-by-sort_order active amenities. Falls back to DEFAULT_AMENITIES. */
export async function listAmenitiesTaxonomy(): Promise<AmenityTaxonomyEntry[]> {
  if (!isSupabaseConfigured) return DEFAULT_AMENITIES;
  try {
    const sb = createSupabasePublicClient();
    const { data } = await sb
      .from("amenities_taxonomy")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (!data || data.length === 0) return DEFAULT_AMENITIES;
    return (data as AmenityTaxonomyRow[]).map(toEntry);
  } catch {
    return DEFAULT_AMENITIES;
  }
}

/**
 * Admin variant: includes inactive entries so the editor at
 * /admin/settings/fields can toggle them back on. Uses the server client
 * (RLS lets staff read inactive rows; the public client filters them
 * by policy).
 *
 * Deliberately NOT `toEntry`: the editor has to see what is actually stored,
 * because a blank `label_ar` is the whole point of the Arabic column on that
 * screen. Reading the store here would paint every row as translated and hide
 * the 87 that are not. The page offers the store's answer as a placeholder
 * instead, which an editor can accept or overwrite.
 */
export async function listAmenitiesTaxonomyForAdmin(): Promise<
  AmenityTaxonomyEntry[]
> {
  if (!isSupabaseConfigured) return DEFAULT_AMENITIES;
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("amenities_taxonomy")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!data || data.length === 0) return DEFAULT_AMENITIES;
    return (data as AmenityTaxonomyRow[]).map((r) => ({
      code: r.code,
      label: r.label,
      label_ar: r.label_ar ?? null,
      category: r.category,
      icon: r.icon,
      sort_order: r.sort_order,
      active: r.active,
    }));
  } catch {
    return DEFAULT_AMENITIES;
  }
}

/** Insert or update one entry. Staff-only via RLS. */
export async function upsertAmenityTaxonomyEntry(
  entry: AmenityTaxonomyEntry,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("amenities_taxonomy").upsert(
      {
        code: entry.code,
        label: entry.label,
        label_ar: entry.label_ar ?? null,
        category: entry.category,
        icon: entry.icon ?? null,
        sort_order: entry.sort_order ?? 0,
        active: entry.active ?? true,
      },
      { onConflict: "code" },
    );
    if (error) {
      console.error("[upsertAmenityTaxonomyEntry]", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[upsertAmenityTaxonomyEntry]", e);
    return false;
  }
}

/**
 * Write just the Arabic twin.
 *
 * A targeted UPDATE rather than an upsert of the whole entry, because the row
 * this touches is one an editor is looking at in a list of 104 — re-sending
 * `category`, `sort_order` and `active` from a stale render is how a screen
 * like that silently reverts a toggle someone made in another tab.
 */
export async function setAmenityLabelAr(
  code: string,
  labelAr: string | null,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await sb
      .from("amenities_taxonomy")
      .update({ label_ar: labelAr })
      .eq("code", code);
    if (error) {
      console.error("[setAmenityLabelAr]", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[setAmenityLabelAr]", e);
    return false;
  }
}

/** Hard delete (rare; prefer `active=false`). */
export async function deleteAmenityTaxonomyEntry(
  code: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await sb
      .from("amenities_taxonomy")
      .delete()
      .eq("code", code);
    return !error;
  } catch {
    return false;
  }
}
