import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import type { Locale } from "@/lib/i18n/locales";
import { localiseJoins, localiseRow } from "@/lib/i18n/localise";

import { COMPARE_CAP } from "@/lib/compare-store";
import type { Database } from "@/db/types";

const COMPARE_FIELDS =
  "id, reference, slug, title, title_ar, price_aed, mode, status, type, beds, baths, built_up_ft2, plot_ft2, floor, year_built, tenure, furnishing, view, view_ar, parking_bays, service_charge_per_ft2, amenities, flags, published_at, created_at, areas:area_id(name, name_ar, slug), property_media(role, media:media_assets(storage_key, filename, alt_text, alt_text_ar))";

type RawMediaJoin = {
  role: Database["public"]["Enums"]["property_media_role"];
  media: {
    storage_key: string;
    filename: string;
    alt_text: string | null;
  } | null;
};

export type ComparableProperty = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  price_aed: number;
  mode: Database["public"]["Enums"]["property_mode"];
  status: Database["public"]["Enums"]["property_status"];
  type: Database["public"]["Enums"]["property_type"];
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  plot_ft2: number | null;
  floor: number | null;
  year_built: number | null;
  tenure: Database["public"]["Enums"]["property_tenure"] | null;
  furnishing: Database["public"]["Enums"]["property_furnishing"] | null;
  view: string | null;
  parking_bays: number | null;
  service_charge_per_ft2: number | null;
  amenities: string[];
  flags: {
    exclusive?: boolean;
    vacant_on_transfer?: boolean;
    mortgage_eligible?: boolean;
  } | null;
  published_at: string | null;
  created_at: string;
  area_name: string | null;
  area_slug: string | null;
  hero: {
    storage_key: string;
    filename: string;
    alt_text: string | null;
  } | null;
};

/**
 * Fetch properties by id for the compare tool. Preserves the caller's id
 * order so cards line up with the URL.
 *
 * `limit` defaults to the compare table's four columns, which is what every
 * compare-side caller wants. The shortlist drawer reuses this query to
 * hydrate its rows and passes `SHORTLIST_CAP` instead — it lists everything
 * saved, and only a chosen subset of that goes on to the table.
 *
 * RLS: properties has a public-read policy for `status = 'published'`,
 * so anon visitors can build a comparison without signing in.
 */
export async function getComparableProperties(
  ids: string[],
  limit: number = COMPARE_CAP,
  /**
   * Which language to fold the rows down to.
   *
   * Ambient by default, like every other public query — but this one has a
   * caller that has no ambient locale to read. `app/api/shortlist/route.ts`
   * sits under `/api`, which `NON_LOCALISED` keeps out of the `[locale]`
   * segment, so nothing ever calls `setRequestLocale` for it and
   * `currentLocale()` there answers "en" on an Arabic page. That is not a
   * theoretical hole: the shortlist drawer fetches through that route, so it
   * listed Arabic listings under their English titles while the compare page
   * one click away showed the Arabic. The route passes the locale in.
   */
  localeOverride?: Locale,
): Promise<ComparableProperty[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];

  const clean = Array.from(
    new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id))),
  ).slice(0, limit);
  if (clean.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select(COMPARE_FIELDS)
    .in("id", clean)
    .eq("status", "published")
    .is("deleted_at", null);

  if (error || !data) return [];

  const order = new Map(clean.map((id, idx) => [id, idx]));
  // This payload is serialised to the browser by app/api/shortlist/route.ts,
  // so an unfolded twin is not merely wrong on /ar — it ships `title_ar` over
  // the wire to every English visitor today.
  const locale = localeOverride ?? (await currentLocale());
  const rows = data.map((row) => {
    const r = row as unknown as {
      property_media?: RawMediaJoin[] | null;
      areas?: { name: string; name_ar: string | null; slug: string } | null;
      amenities: string[] | null;
    } & Record<string, unknown>;
    const hero =
      r.property_media?.find((j) => j.role === "hero" && j.media)?.media ??
      null;
    // The area arrives as one opaque join value, so its `name_ar` pairs with
    // nothing at the row level and `localiseRow` walks straight past it —
    // which is exactly what `localiseJoins` exists for. Without it the
    // shortlist card and the compare columns printed "Al Reem Island" under
    // an otherwise fully Arabic listing.
    const area = localiseJoins(r, ["areas"], locale).areas as
      | { name: string; slug: string }
      | null
      | undefined;
    // The two joins are dropped rather than spread. `localiseRow` walks one
    // level, so `areas` and `property_media` pass through it untouched and
    // carry their `name_ar` / `alt_text_ar` into the result — and this row is
    // the payload `/api/shortlist` serialises to the browser. `area_name` and
    // `hero` below are the folded forms of both, so the raw ones are not just
    // a leak, they are a second copy of the same data in the wrong language.
    const {
      areas: _areas,
      property_media: _media,
      ...rest
    } = localiseRow(r as unknown as Record<string, unknown>, locale);
    return {
      ...rest,
      area_name: area?.name ?? null,
      area_slug: area?.slug ?? null,
      amenities: r.amenities ?? [],
      hero: hero
        ? localiseRow(hero as unknown as Record<string, unknown>, locale)
        : null,
    } as unknown as ComparableProperty;
  });

  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return rows;
}
