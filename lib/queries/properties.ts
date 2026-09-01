import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { PropertyFilters } from "@/lib/filters/property";
import type { Database } from "@/db/types";
import { currentLocale } from "@/lib/i18n/current";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { localiseRow } from "@/lib/i18n/localise";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

type Mode = Database["public"]["Enums"]["property_mode"];
type Status = Database["public"]["Enums"]["property_status"];
type Form = Database["public"]["Enums"]["property_form"];

/*
 * The Arabic twins ride here rather than being fetched separately, which is
 * the whole reason twin columns were chosen over a translations table: a
 * folded read costs no extra round-trip.
 *
 * `alt_text_ar` sits INSIDE the nested media join. `localiseRow` walks one
 * level, so a twin selected at the row level would never reach it — see
 * `pickHero`.
 */
const LISTING_FIELDS =
  "id, reference, slug, title, title_ar, short_description, short_description_ar, price_aed, mode, property_form, status, type, beds, baths, built_up_ft2, flags, geo, published_at, created_at, areas:area_id(name, name_ar, slug), property_media(role, media:media_assets(storage_key, filename, alt_text, alt_text_ar))";

const DETAIL_FIELDS =
  "id, reference, slug, title, title_ar, short_description, short_description_ar, description, description_ar, price_aed, mode, status, type, beds, baths, built_up_ft2, plot_ft2, year_built, tenure, furnishing, view, view_ar, orientation, orientation_ar, parking_bays, service_charge_per_ft2, amenities, flags, dld_plot_number, listing_permit_no, address_line, address_line_ar, floor, published_at, created_at, updated_at, areas:area_id(name, name_ar, slug), developments:development_id(name, name_ar, slug), property_media(role, sort_order, media:media_assets(storage_key, filename, alt_text, alt_text_ar))";

type RawMediaJoin = {
  role: Database["public"]["Enums"]["property_media_role"];
  sort_order?: number;
  media: {
    storage_key: string;
    filename: string;
    alt_text: string | null;
    alt_text_ar?: string | null;
  } | null;
};

function pickHero(joins: RawMediaJoin[] | null | undefined, locale: Locale) {
  if (!joins) return null;
  const hero = joins.find((j) => j.role === "hero" && j.media);
  if (!hero?.media) return null;
  // Folded here because this is the only point the nested media row is
  // visible; the row-level fold in `attachHero` cannot reach one level down.
  return localiseRow(
    hero.media as unknown as Record<string, unknown>,
    locale,
  ) as unknown as HeroMedia;
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
  /** Buy-side completion form; null for rentals and unclassified sale stock. */
  property_form: Form | null;
  status: Status;
  type: Database["public"]["Enums"]["property_type"];
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  flags: {
    exclusive?: boolean;
    vacant_on_transfer?: boolean;
    mortgage_eligible?: boolean;
  } | null;
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

/**
 * Drop the media join and hoist the hero, folding the row on the way through.
 *
 * Deliberately SYNCHRONOUS, taking the locale as an argument. Every one of the
 * four call sites launders the result through `as unknown as ListingRow[]`,
 * which would erase a `Promise<ListingRow>[]` completely — lint, typecheck and
 * build would all pass while every listing card on /buy, /rent, /off-plan,
 * /commercial, the home grid and /agents/[slug] rendered undefined in every
 * field. Resolve the locale once in the caller; never make this async.
 *
 * `...rest` is a passthrough spread, so without the fold the twins would ship
 * to the renderer as well as leaving English on /ar — and `compare.ts` proves
 * that is not academic, since its payload is serialised to the browser.
 */
function attachHero<T extends { property_media?: RawMediaJoin[] | null }>(
  row: T,
  locale: Locale,
): Omit<T, "property_media"> & { hero: HeroMedia } {
  const { property_media, ...rest } = row;
  const folded = localiseRow(
    rest as unknown as Record<string, unknown>,
    locale,
  ) as unknown as Record<string, unknown>;

  /*
   * The joined area and development, one level down.
   *
   * Same blind spot `pickHero` exists for: `localiseRow` walks a single level,
   * so `areas: { name, name_ar }` arrives as one opaque value and its twin
   * never pairs with anything. The join did not even SELECT `name_ar` until
   * now, so "Hudayriyat Island" rendered in English on every Arabic listing
   * card and detail page while `جزيرة الحديريات` sat in the store and in
   * `areas.name_ar`.
   */
  for (const key of ["areas", "developments"] as const) {
    const join = folded[key];
    if (join && typeof join === "object" && !Array.isArray(join)) {
      folded[key] = localiseRow(join as Record<string, unknown>, locale);
    }
  }

  /*
   * Amenities are a bare `text[]` with no twin column, which `localiseDeep`'s
   * docblock calls out as passing "untouched — there is no twin to pair them
   * with at that depth". True, and it left every amenity chip in English on
   * /ar even though the store holds Arabic for all 99 of them.
   *
   * There is no per-row twin to add here: the values are a shared vocabulary
   * from `amenities_taxonomy`, not this listing's prose. So the store IS the
   * translation, and this asks it directly. An unknown value keeps its
   * English, exactly as `arabicFor` does everywhere else.
   */
  if (locale !== DEFAULT_LOCALE && Array.isArray(folded.amenities)) {
    folded.amenities = (folded.amenities as unknown[]).map((value) =>
      typeof value === "string" ? (arabicFor(value) ?? value) : value,
    );
  }

  return {
    ...(folded as unknown as Omit<T, "property_media">),
    hero: pickHero(property_media, locale),
  };
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

/**
 * The row values a search surface means when it asks for one `mode`.
 *
 * "Buy" is an umbrella, not a row value. Someone browsing for sale wants
 * ready, resale *and* off-plan — a plan bought off-plan is still a purchase.
 * `properties.mode` records the narrower fact, so the buy surfaces have to
 * expand to both. Off-plan keeps its own route for visitors who specifically
 * want pre-handover stock; buy is the superset, not a competitor.
 *
 * This is not academic: every published row in the catalogue is `off_plan`
 * today, so `.eq('mode', 'buy')` renders /buy/search and the home page's
 * featured rail empty against a perfectly healthy catalogue.
 *
 * Deliberately not `neq('rent')` — that is what the area guide's sale band
 * uses (`lib/queries/area-inventory.ts`), and it sweeps in `commercial`,
 * which has its own mode tab on the search surfaces.
 *
 * `form` still narrows on top: /buy/ready and /buy/resale filter
 * `property_form`, which off-plan rows do not carry, so they stay exact.
 */
const MODE_UMBRELLA: Partial<Record<Mode, readonly Mode[]>> = {
  buy: ["buy", "off_plan"],
};

/** Apply a mode filter, expanding the umbrella modes to the rows they cover. */
function filterByMode<
  T extends {
    eq: (c: string, v: string) => T;
    in: (c: string, v: readonly string[]) => T;
  },
>(query: T, mode: Mode): T {
  const umbrella = MODE_UMBRELLA[mode];
  return umbrella ? query.in("mode", umbrella) : query.eq("mode", mode);
}

/** List published listings for the public marketplace. */
export async function listPublishedProperties(opts: {
  mode?: Mode;
  /** Narrows sale stock to one completion form — drives /buy/ready and /buy/resale. */
  form?: Form;
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

  if (opts.mode) query = filterByMode(query, opts.mode);
  if (opts.form) query = query.eq("property_form", opts.form);

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
    // The segmented control above the results. Absent means both, which is
    // what "no filter" has to mean — a search route defaulting to residential
    // would hide the commercial stock from anyone who never touched the
    // control, on a site whose catalogue is almost entirely residential and
    // where nobody would think to look.
    if (filters.segment) query = query.eq("segment", filters.segment);
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
    if (filters.ft2_min != null)
      query = query.gte("built_up_ft2", filters.ft2_min);
    if (filters.ft2_max != null)
      query = query.lte("built_up_ft2", filters.ft2_max);
    if (filters.year_min != null)
      query = query.gte("year_built", filters.year_min);
    if (filters.year_max != null)
      query = query.lte("year_built", filters.year_max);
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
      query = query.order("built_up_ft2", {
        ascending: false,
        nullsFirst: false,
      });
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
  const locale = await currentLocale();
  const rows = (data ?? []).map((row) =>
    attachHero(row as unknown as { property_media: RawMediaJoin[] }, locale),
  ) as unknown as ListingRow[];
  return { rows, total: count ?? 0 };
}

/** Find a single published property by reference (case-insensitive). */
export async function getPublishedPropertyByReference(
  reference: string,
  /*
   * Optional, and it has to be. Callers OUTSIDE the [locale] segment must pass
   * one explicitly: `app/[locale]/(public)/p/[slug]/opengraph-image.tsx` is a
   * metadata route, which renders outside the layout tree with no
   * `setRequestLocale` above it, so an ambient read there is a dynamic API and
   * silently drops the route off prerendering. `/p/[slug]/opengraph-image` is
   * in the G-1 baseline; the same trap is already documented on
   * `article-categories.ts` and `developers-extras.ts`.
   */
  locale?: Locale,
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
    locale ?? (await currentLocale()),
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
  // Same umbrella as the search surfaces: "similar" to a sale listing means
  // other sale stock, off-plan included.
  let query = filterByMode(
    supabase
      .from("properties")
      .select(LISTING_FIELDS)
      .neq("id", excludeId)
      .eq("status", "published")
      .is("deleted_at", null),
    mode,
  )
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
  const locale = await currentLocale();
  return (data ?? []).map((row) =>
    attachHero(row as unknown as { property_media: RawMediaJoin[] }, locale),
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

  const locale = await currentLocale();
  const rows = (data ?? []).map((row) =>
    attachHero(row as unknown as { property_media: RawMediaJoin[] }, locale),
  ) as unknown as ListingRow[];

  const order = new Map(ids.map((id, idx) => [id, idx]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Admin: list ALL properties (any status). Uses the auth-aware server client
 *  so RLS gates this to staff users only.
 *
 *  Sprint 7b: accepts an optional `status` filter so the dashboard's
 *  `?status=published` deep-link works (was a no-op pre-Sprint 7).
 */
export async function listAllPropertiesForAdmin(opts: {
  limit?: number;
  offset?: number;
  status?: Status;
}): Promise<{ rows: ListingRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("properties")
    .select(LISTING_FIELDS, { count: "exact" })
    .is("deleted_at", null);
  if (opts.status) query = query.eq("status", opts.status);
  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);
  const { data, error, count } = await query;
  if (error) {
    console.error("[listAllPropertiesForAdmin]", error);
    return { rows: [], total: 0 };
  }
  // DEFAULT_LOCALE: the CMS grid is English by decision (ADR-0007), and an
  // editor needs to see the English they are about to change.
  const rows = (data ?? []).map((row) =>
    attachHero(
      row as unknown as { property_media: RawMediaJoin[] },
      DEFAULT_LOCALE,
    ),
  ) as unknown as ListingRow[];
  return { rows, total: count ?? 0 };
}

/** Admin: count properties per status. Sprint 7b — for status-tab badges. */
export async function countAdminPropertiesByStatus(): Promise<
  Record<Status | "all", number>
> {
  const empty: Record<Status | "all", number> = {
    all: 0,
    draft: 0,
    in_review: 0,
    published: 0,
    off_market: 0,
    archived: 0,
  };
  if (!isSupabaseConfigured) return empty;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select("status")
    .is("deleted_at", null);
  if (error || !data) {
    if (error) console.error("[countAdminPropertiesByStatus]", error);
    return empty;
  }
  const out = { ...empty };
  for (const row of data as { status: Status }[]) {
    out[row.status] = (out[row.status] ?? 0) + 1;
    out.all += 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Sprint 11 — sold-state existence check.
// ─────────────────────────────────────────────────────────────────────

export type PropertyExistence = {
  reference: string;
  slug: string;
  status: Status;
  sold_at: string | null;
};

/** Look up a property by reference *without* the published-status filter.
 *  Used by /p/[slug] to detect sold/archived listings and redirect to
 *  /sold/[ref] (410 Gone) before falling through to notFound(). */
export async function getPropertyExistenceByReference(
  reference: string,
): Promise<PropertyExistence | null> {
  if (!isSupabaseConfigured || !reference) return null;
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("properties")
      .select("reference, slug, status")
      .ilike("reference", reference)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return null;
    return {
      reference: data.reference,
      slug: data.slug,
      status: data.status,
      // sold_at lands in migration 0020. Until the column exists, treat
      // a flipped status of 'off_market' as the sold signal.
      sold_at: null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Sprint 8 additions — audit-log scope + sold-state mutation.
// ─────────────────────────────────────────────────────────────────────

export type PropertyAuditEntry = {
  id: string;
  actor_id: string | null;
  actor_kind: Database["public"]["Enums"]["audit_actor_kind"];
  action: string;
  before: unknown;
  after: unknown;
  at: string;
};

/** Audit-log rows scoped to a single property — powers the History tab
 *  on the property editor (Sprint 7c). Ordered newest first. */
export async function getPropertyAuditLog(
  propertyId: string,
  limit = 50,
): Promise<PropertyAuditEntry[]> {
  if (!isSupabaseConfigured || !propertyId) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, actor_id, actor_kind, action, before, after, at")
      .eq("target_kind", "property")
      .eq("target_id", propertyId)
      .order("at", { ascending: false })
      .limit(limit);
    if (error || !data) {
      if (error) console.error("[getPropertyAuditLog]", error);
      return [];
    }
    return data as PropertyAuditEntry[];
  } catch {
    return [];
  }
}

/** Mark a property as sold. Sets sold_at; sold-state guard on /p/[slug]
 *  redirects to /sold/[ref] which returns 410 Gone (Sprint 11).
 *
 *  sold_at lands in migration 0020 — until the migration is applied,
 *  the column won't exist and Postgres will reject the field. The
 *  status flip to 'off_market' still applies. */
export async function markPropertySold(
  propertyId: string,
  soldAt: Date = new Date(),
): Promise<boolean> {
  if (!isSupabaseConfigured || !propertyId) return false;
  try {
    const supabase = await createSupabaseServerClient();
    const payload: Record<string, unknown> = {
      sold_at: soldAt.toISOString(),
      status: "off_market",
    };
    const { error } = await (
      supabase.from("properties") as unknown as {
        update(p: Record<string, unknown>): {
          eq(col: string, val: string): Promise<{ error: unknown }>;
        };
      }
    )
      .update(payload)
      .eq("id", propertyId);
    if (error) {
      console.error("[markPropertySold]", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[markPropertySold]", e);
    return false;
  }
}

// Re-export the pure utilities so existing imports keep working.
export {
  formatPriceAED,
  propertyUrl,
  extractReferenceFromSlug,
} from "./property-utils";
