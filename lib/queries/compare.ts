import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";

import { COMPARE_CAP } from "@/lib/compare-store";
import type { Database } from "@/db/types";

const COMPARE_FIELDS =
  "id, reference, slug, title, title_ar, price_aed, mode, status, type, beds, baths, built_up_ft2, plot_ft2, floor, year_built, tenure, furnishing, view, view_ar, parking_bays, service_charge_per_ft2, amenities, flags, published_at, created_at, areas:area_id(name, slug), property_media(role, media:media_assets(storage_key, filename, alt_text, alt_text_ar))";

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
  const locale = await currentLocale();
  const rows = data.map((row) => {
    const r = row as unknown as {
      property_media?: RawMediaJoin[] | null;
      areas?: { name: string; slug: string } | null;
      amenities: string[] | null;
    } & Record<string, unknown>;
    const hero =
      r.property_media?.find((j) => j.role === "hero" && j.media)?.media ??
      null;
    return {
      ...(localiseRow(
        r as unknown as Record<string, unknown>,
        locale,
      ) as object),
      area_name: r.areas?.name ?? null,
      area_slug: r.areas?.slug ?? null,
      amenities: r.amenities ?? [],
      hero: hero
        ? localiseRow(hero as unknown as Record<string, unknown>, locale)
        : null,
    } as ComparableProperty;
  });

  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return rows;
}
