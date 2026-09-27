import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
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
  "id, reference, slug, title, title_ar, short_description, short_description_ar, price_aed, mode, status, type, beds, baths, built_up_ft2, flags, geo, published_at, created_at, areas:area_id(name, name_ar, slug), property_media(role, media:media_assets(storage_key, filename, alt_text, alt_text_ar))";

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
 * The row, plus the area joined onto it.
 *
 * `localiseRow` walks a single level and stops, so `areas: {name, name_ar}`
 * arrives as one opaque value and its twin never pairs with anything. This is
 * the same blind spot `lib/queries/properties.ts` documents and folds around —
 * and this module, which feeds the home page's featured row, was missed. The
 * join did not even SELECT `name_ar`, so "Saadiyat Island" and "Yas Island"
 * printed in English on every card of the Arabic home page while
 * `جزيرة السعديات` sat in `areas.name_ar` unread.
 *
 * Exported so `featured-properties.fold.test.ts` can run the real fold rather
 * than a stand-in — the whole point of `fold-harness.ts` is that a fold
 * applied one step too late type-checks and does nothing.
 */
export function foldRow(
  row: Record<string, unknown>,
  locale: Locale,
): Record<string, unknown> {
  const folded = localiseRow(row, locale) as Record<string, unknown>;
  const area = folded.areas;
  if (area && typeof area === "object" && !Array.isArray(area)) {
    folded.areas = localiseRow(area as Record<string, unknown>, locale);
  }
  return folded;
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
    ...(foldRow(rest as unknown as Record<string, unknown>, locale) as unknown as Omit<
      ListingRow,
      "hero"
    >),
    hero: pickHero(property_media, locale),
  })) as ListingRow[];

  const byReference = new Map(rows.map((r) => [r.reference, r]));
  return references
    .map((reference) => byReference.get(reference))
    .filter((r): r is ListingRow => r !== undefined);
}

/**
 * One listing as the pickers offer it.
 *
 * A title alone is not enough to pick by. Three live listings are called "Yas
 * Riva Reserve", all on Yas Island, and the reference that tells them apart
 * was the value stored, never something shown — so an editor chose between
 * identical lines and found out which one they had got in the preview. The
 * facts below are what an advisor would say to tell two listings apart: what
 * it is, how big, what it costs, sale or rent, and what it looks like.
 */
export type PropertyOption = {
  /**
   * The row id. The listing pickers store the reference, but an article's
   * internal link stores the id (lib/internal-links/model.ts), so the blog
   * editor's picker needs it to say which record a block points at.
   */
  id: string;
  reference: string;
  /**
   * The URL slug — not unique on its own (those three share one), which is
   * why the listing URL carries the reference too; see `propertyUrl`.
   */
  slug: string;
  title: string;
  areaName: string | null;
  mode: string | null;
  type: string | null;
  beds: number | null;
  baths: number | null;
  builtUpFt2: number | null;
  priceAed: number | null;
  /** The hero photograph's public URL, for the thumbnail. */
  heroUrl: string | null;
};

type OptionRow = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  mode: string | null;
  type: string | null;
  beds: number | null;
  baths: number | null;
  built_up_ft2: number | null;
  price_aed: number | string | null;
  areas: { name: string } | null;
  property_media: { role: string; media: { storage_key: string } | null }[] | null;
};

/** Published listings offered by the listing pickers, newest first. */
export async function listPropertyOptions(
  limit = 200,
): Promise<PropertyOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, reference, slug, title, mode, type, beds, baths, built_up_ft2, price_aed, areas:area_id(name), property_media(role, media:media_assets(storage_key))",
    )
    .eq("status", "published")
    .is("deleted_at", null)
    // Only the hero joins through. Filtering the embedded rows rather than the
    // parents keeps every listing — one with no hero still gets a line, just
    // no thumbnail — and saves shipping every gallery row for 200 listings to
    // draw one 40px square each.
    .eq("property_media.role", "hero")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    if (error) console.error("[listPropertyOptions]", error);
    return [];
  }
  return (data as unknown as OptionRow[]).map((r) => {
    const hero = (r.property_media ?? []).find(
      (m) => m.role === "hero" && m.media,
    );
    return {
      id: r.id,
      reference: r.reference,
      slug: r.slug,
      title: r.title,
      areaName: r.areas?.name ?? null,
      mode: r.mode ?? null,
      type: r.type ?? null,
      beds: r.beds ?? null,
      baths: r.baths ?? null,
      builtUpFt2: r.built_up_ft2 ?? null,
      priceAed: r.price_aed != null ? Number(r.price_aed) : null,
      heroUrl: hero?.media ? mediaPublicUrl(hero.media.storage_key) : null,
    };
  });
}
