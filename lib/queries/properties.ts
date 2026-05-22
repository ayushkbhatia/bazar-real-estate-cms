import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { PropertyFilters } from "@/lib/filters/property";
import type { Database } from "@/db/types";

/** Return a set of propertyIds that the current signed-in user has saved.
 *  Returns an empty set for anon users or any failure. */
export async function getSavedPropertyIds(
  propertyIds: string[],
): Promise<Set<string>> {
  if (!isSupabaseConfigured || propertyIds.length === 0) return new Set();
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Set();
    const { data } = await supabase
      .from("saved_properties")
      .select("property_id")
      .eq("user_id", user.id)
      .in("property_id", propertyIds);
    return new Set((data ?? []).map((r) => r.property_id));
  } catch {
    return new Set();
  }
}

type Mode = Database["public"]["Enums"]["property_mode"];
type Status = Database["public"]["Enums"]["property_status"];

const LISTING_FIELDS =
  "id, reference, slug, title, short_description, price_aed, mode, status, type, beds, baths, built_up_ft2, flags, geo, published_at, created_at, areas:area_id(name, slug), property_media(role, media:media_assets(storage_key, filename, alt_text))";

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

export type Geo = { lat: number; lng: number } | null;

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
  geo: Geo;
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

/** Resolve an area slug into its UUID. Returns null if not found. */
async function resolveAreaId(
  supabase: ReturnType<typeof createSupabasePublicClient>,
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("areas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

/** List published listings for the public marketplace. */
export async function listPublishedProperties(opts: {
  mode?: Mode;
  filters?: PropertyFilters;
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

  const filters = opts.filters;
  if (filters) {
    if (filters.q) {
      // Postgres full-text search. websearch syntax supports quoted phrases
      // and "term1 OR term2" out of the box.
      query = query.textSearch("search_text", filters.q, {
        type: "websearch",
        config: "english",
      });
    }
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.beds != null) {
      // 5+ buckets — treat the value as a minimum once it hits the cap.
      if (filters.beds >= 5) query = query.gte("beds", 5);
      else query = query.eq("beds", filters.beds);
    }
    if (filters.baths != null) {
      if (filters.baths >= 4) query = query.gte("baths", 4);
      else query = query.eq("baths", filters.baths);
    }
    if (filters.price_min != null)
      query = query.gte("price_aed", filters.price_min);
    if (filters.price_max != null)
      query = query.lte("price_aed", filters.price_max);

    if (filters.area) {
      const id = await resolveAreaId(supabase, filters.area);
      if (id) query = query.eq("area_id", id);
      else return { rows: [], total: 0 }; // bogus area slug → no results
    }

    // Sprint 4b: extended facets.
    if (filters.ft2_min != null) query = query.gte("built_up_ft2", filters.ft2_min);
    if (filters.ft2_max != null) query = query.lte("built_up_ft2", filters.ft2_max);
    if (filters.year_min != null) query = query.gte("year_built", filters.year_min);
    if (filters.year_max != null) query = query.lte("year_built", filters.year_max);
    if (filters.tenure) query = query.eq("tenure", filters.tenure);
    if (filters.furnishing) query = query.eq("furnishing", filters.furnishing);
    if (filters.amenities && filters.amenities.length > 0) {
      // properties.amenities is a text[]; `contains` performs a superset check.
      query = query.contains("amenities", filters.amenities);
    }
    if (filters.advisor) {
      // advisor slug → staff user_id lookup, then equality.
      const { data: staffRow } = await supabase
        .from("staff")
        .select("user_id")
        .eq("slug", filters.advisor)
        .maybeSingle();
      if (staffRow) query = query.eq("assigned_agent_id", staffRow.user_id);
      else return { rows: [], total: 0 };
    }
    if (filters.verified) {
      // Bazar Verified is a flag stored in jsonb. Use the @> superset op.
      query = query.contains("flags", { verified: true });
    }
  }

  // Sort.
  const sort = opts.filters?.sort ?? null;
  switch (sort) {
    case "price_asc":
      query = query.order("price_aed", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_aed", { ascending: false });
      break;
    case "area_desc":
      query = query
        .order("built_up_ft2", { ascending: false, nullsFirst: false });
      break;
    case "recent":
    default:
      query = query.order("published_at", { ascending: false });
  }

  const offset = opts.offset ?? 0;
  query = query.range(offset, offset + (opts.limit ?? 24) - 1);

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

/** Look up listing rows by id, preserving the order of `ids`. Used by the
 *  saved-properties view to render in save-order. RLS still applies. */
export async function listPropertiesByIds(
  ids: string[],
): Promise<ListingRow[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(LISTING_FIELDS)
    .in("id", ids)
    .is("deleted_at", null);
  if (error || !data) return [];

  const rows = (data ?? []).map((row) =>
    attachHero(row as unknown as { property_media: RawMediaJoin[] }),
  ) as unknown as ListingRow[];

  const order = new Map(ids.map((id, idx) => [id, idx]));
  return rows.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
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

// Re-export the pure utilities so existing imports keep working.
export {
  formatPriceAED,
  propertyUrl,
  extractReferenceFromSlug,
} from "./property-utils";
