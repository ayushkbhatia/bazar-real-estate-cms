/**
 * Amenity taxonomy — the canonical vocabulary backing the 21-toggle
 * grid on the property editor (Sprint 7c) and the search facet
 * (Sprint 4b). Falls back to DEFAULT_AMENITIES from the schema when
 * Supabase is offline or the table is empty.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { s8 } from "@/lib/supabase/sprint-8";
import {
  DEFAULT_AMENITIES,
  type AmenityTaxonomyEntry,
} from "@/lib/schemas/amenity-taxonomy";
import type { AmenityTaxonomyRow } from "@/lib/types/sprint-8";

/** Sorted-by-sort_order active amenities. Falls back to DEFAULT_AMENITIES. */
export async function listAmenitiesTaxonomy(): Promise<
  AmenityTaxonomyEntry[]
> {
  if (!isSupabaseConfigured) return DEFAULT_AMENITIES;
  try {
    const sb = createSupabasePublicClient();
    const { data } = await s8(sb)
      .from("amenities_taxonomy")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (!data || data.length === 0) return DEFAULT_AMENITIES;
    return (data as AmenityTaxonomyRow[]).map((r) => ({
      code: r.code,
      label: r.label,
      category: r.category,
      icon: r.icon,
      sort_order: r.sort_order,
      active: r.active,
    }));
  } catch {
    return DEFAULT_AMENITIES;
  }
}

/**
 * Admin variant: includes inactive entries so the editor at
 * /admin/settings/fields can toggle them back on. Uses the server client
 * (RLS lets admins read inactive rows; the public client filters them
 * by policy).
 */
export async function listAmenitiesTaxonomyForAdmin(): Promise<
  AmenityTaxonomyEntry[]
> {
  if (!isSupabaseConfigured) return DEFAULT_AMENITIES;
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await s8(sb)
      .from("amenities_taxonomy")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!data || data.length === 0) return DEFAULT_AMENITIES;
    return (data as AmenityTaxonomyRow[]).map((r) => ({
      code: r.code,
      label: r.label,
      category: r.category,
      icon: r.icon,
      sort_order: r.sort_order,
      active: r.active,
    }));
  } catch {
    return DEFAULT_AMENITIES;
  }
}

/** Insert or update one entry. Admin-only via RLS. */
export async function upsertAmenityTaxonomyEntry(
  entry: AmenityTaxonomyEntry,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await s8(sb)
      .from("amenities_taxonomy")
      .upsert(
        {
          code: entry.code,
          label: entry.label,
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

/** Hard delete (rare; prefer `active=false`). */
export async function deleteAmenityTaxonomyEntry(
  code: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await s8(sb)
      .from("amenities_taxonomy")
      .delete()
      .eq("code", code);
    return !error;
  } catch {
    return false;
  }
}
