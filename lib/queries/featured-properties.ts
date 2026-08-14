import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
import { type Locale } from "@/lib/i18n/locales";

import type { ListingRow } from "@/lib/queries/properties";

/**
 * Listings curated by hand in a master page (the home page's featured row).
 *
 * Picks are stored as the property's **reference** — `BAZ-AD-04891` — rather
 * than its id or slug: it's unique, stable across renames, and legible in the
 * raw section document when someone is reading the JSON.
 */

const FIELDS =
  "id, reference, slug, title, title_ar, short_description, short_description_ar, price_aed, mode, status, type, beds, baths, built_up_ft2, flags, geo, published_at, created_at, areas:area_id(name, slug), property_media(role, media:media_assets(storage_key, filename, alt_text, alt_text_ar))";

type MediaJoin = {
  role: string;
  media: {
    storage_key: string;
    filename: string;
    alt_text: string | null;
  } | null;
};

function pickHero(joins: MediaJoin[] | null, locale: Locale) {
  const hero = (joins ?? []).find((j) => j.role === "hero" && j.media);
  if (!hero?.media) return null;
  // The nested alt text; the row-level fold cannot reach one level down.
  return localiseRow(
    hero.media as unknown as Record<string, unknown>,
    locale,
  ) as unknown as typeof hero.media;
}

/**
 * Resolve curated references to live listings, in the order they were picked.
 *
 * Anything that no longer resolves — unpublished, deleted, a typo — is simply
 * absent from the result, so the row shows the picks that are still valid
 * rather than a gap or a card linking nowhere.
 */
export async function listPropertiesByReference(
  references: string[],
): Promise<ListingRow[]> {
  if (!isSupabaseConfigured || references.length === 0) return [];

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(FIELDS)
    .in("reference", references.slice(0, 24))
    .eq("status", "published")
    .is("deleted_at", null);

  if (error || !data) {
    if (error) console.error("[listPropertiesByReference]", error);
    return [];
  }

  const locale = await currentLocale();
  const rows = (
    data as unknown as (Omit<ListingRow, "hero"> & {
      property_media: MediaJoin[] | null;
    })[]
  ).map(({ property_media, ...rest }) => ({
    // `...rest` is a passthrough spread, so an unfolded twin leaks as well as
    // rendering English.
    ...(localiseRow(
      rest as unknown as Record<string, unknown>,
      locale,
    ) as unknown as Omit<ListingRow, "hero">),
    hero: pickHero(property_media, locale),
  })) as ListingRow[];

  const byReference = new Map(rows.map((r) => [r.reference, r]));
  return references
    .map((reference) => byReference.get(reference))
    .filter((r): r is ListingRow => r !== undefined);
}

export type PropertyOption = {
  reference: string;
  title: string;
  areaName: string | null;
};

/** Published listings offered by the featured-properties picker. */
export async function listPropertyOptions(
  limit = 200,
): Promise<PropertyOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select("reference, title, areas:area_id(name)")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    if (error) console.error("[listPropertyOptions]", error);
    return [];
  }
  return (
    data as unknown as {
      reference: string;
      title: string;
      areas: { name: string } | null;
    }[]
  ).map((r) => ({
    reference: r.reference,
    title: r.title,
    areaName: r.areas?.name ?? null,
  }));
}
