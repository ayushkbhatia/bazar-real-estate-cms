import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";

type Mode = Database["public"]["Enums"]["property_mode"];
type Status = Database["public"]["Enums"]["property_status"];

const LISTING_FIELDS =
  "id, reference, slug, title, short_description, price_aed, mode, status, type, beds, baths, built_up_ft2, flags, published_at, created_at, areas:area_id(name, slug), property_media(role, media:media_assets(storage_key, filename, alt_text))";

const DETAIL_FIELDS =
  "id, reference, slug, title, short_description, description, price_aed, mode, status, type, beds, baths, built_up_ft2, plot_ft2, year_built, tenure, furnishing, view, orientation, parking_bays, service_charge_per_ft2, amenities, flags, dld_plot_number, listing_permit_no, address_line, floor, published_at, created_at, updated_at, areas:area_id(name, slug), developments:development_id(name, slug), property_media(role, sort_order, media:media_assets(storage_key, filename, alt_text))";

type RawMediaJoin = {
  role: Database["public"]["Enums"]["property_media_role"];
  sort_order?: number;
  media: {
    storage_key: string;
    filename: string;
    alt_text: string | null;
  } | null;
};

function pickHero(joins: RawMediaJoin[] | null | undefined) {
  if (!joins) return null;
  const hero = joins.find((j) => j.role === "hero" && j.media);
  return hero?.media ?? null;
}

export type HeroMedia = {
  storage_key: string;
  filename: string;
  alt_text: string | null;
} | null;

export type ListingRow = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  short_description: string | null;
  price_aed: number;
  mode: Mode;
  status: Status;
  type: Database["public"]["Enums"]["property_type"];
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  flags: { exclusive?: boolean; vacant_on_transfer?: boolean; mortgage_eligible?: boolean } | null;
  published_at: string | null;
  created_at: string;
  areas: { name: string; slug: string } | null;
  hero: HeroMedia;
};

export type PropertyDetail = ListingRow & {
  description: string | null;
  plot_ft2: number | null;
  year_built: number | null;
  tenure: Database["public"]["Enums"]["property_tenure"] | null;
  furnishing: Database["public"]["Enums"]["property_furnishing"] | null;
  view: string | null;
  orientation: string | null;
  parking_bays: number | null;
  service_charge_per_ft2: number | null;
  amenities: string[];
  dld_plot_number: string | null;
  listing_permit_no: string | null;
  address_line: string | null;
  floor: number | null;
  updated_at: string;
  developments: { name: string; slug: string } | null;
};

function attachHero<T extends { property_media?: RawMediaJoin[] | null }>(
  row: T,
): Omit<T, "property_media"> & { hero: HeroMedia } {
  const { property_media, ...rest } = row;
  return { ...rest, hero: pickHero(property_media) };
}

/** List published listings for the public marketplace. */
export async function listPublishedProperties(opts: {
  mode?: Mode;
  limit?: number;
  offset?: number;
}): Promise<{ rows: ListingRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = createSupabasePublicClient();
  let query = supabase
    .from("properties")
    .select(LISTING_FIELDS, { count: "exact" })
    .eq("status", "published")
    .is("deleted_at", null);
  if (opts.mode) query = query.eq("mode", opts.mode);
  query = query
    .order("published_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 24) - 1);
  const { data, error, count } = await query;
  if (error) {
    console.error("[listPublishedProperties]", error);
    return { rows: [], total: 0 };
  }
  const rows = (data ?? []).map((row) =>
    attachHero(row as unknown as { property_media: RawMediaJoin[] }),
  ) as unknown as ListingRow[];
  return { rows, total: count ?? 0 };
}

/** Find a single published property by reference (case-insensitive). */
export async function getPublishedPropertyByReference(
  reference: string,
): Promise<PropertyDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(DETAIL_FIELDS)
    .ilike("reference", reference)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[getPublishedPropertyByReference]", error);
    return null;
  }
  if (!data) return null;
  return attachHero(
    data as unknown as { property_media: RawMediaJoin[] },
  ) as unknown as PropertyDetail;
}

/** Find 4 similar published listings in the same area, excluding this id. */
export async function getSimilarProperties(
  excludeId: string,
  areaSlug: string | null,
  mode: Mode,
): Promise<ListingRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  let query = supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .neq("id", excludeId)
    .eq("status", "published")
    .eq("mode", mode)
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(4);
  if (areaSlug) {
    const { data: area } = await supabase
      .from("areas")
      .select("id")
      .eq("slug", areaSlug)
      .maybeSingle();
    if (area?.id) query = query.eq("area_id", area.id);
  }
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((row) =>
    attachHero(row as unknown as { property_media: RawMediaJoin[] }),
  ) as unknown as ListingRow[];
}

/** Admin: list ALL properties (any status). Uses the auth-aware server client
 *  so RLS gates this to staff users only. */
export async function listAllPropertiesForAdmin(opts: {
  limit?: number;
  offset?: number;
}): Promise<{ rows: ListingRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("properties")
    .select(LISTING_FIELDS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
  if (error) {
    console.error("[listAllPropertiesForAdmin]", error);
    return { rows: [], total: 0 };
  }
  const rows = (data ?? []).map((row) =>
    attachHero(row as unknown as { property_media: RawMediaJoin[] }),
  ) as unknown as ListingRow[];
  return { rows, total: count ?? 0 };
}

/** Format AED with K/M suffix. */
export function formatPriceAED(aed: number): string {
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(1)}M`;
  if (aed >= 1_000) return `AED ${(aed / 1_000).toFixed(0)}K`;
  return `AED ${aed.toLocaleString()}`;
}

/** Build canonical URL for a property: /p/<slug>-<reference-lowercased>. */
export function propertyUrl(row: { slug: string; reference: string }): string {
  return `/p/${row.slug}-${row.reference.toLowerCase()}`;
}

/** Reverse: given a `[slug]` param, extract the trailing BAZ-XX-NNNN reference. */
export function extractReferenceFromSlug(slug: string): string | null {
  const match = slug.match(/(baz-[a-z]+-\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}
