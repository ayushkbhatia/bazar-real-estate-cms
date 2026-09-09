/**
 * Companion queries for the development detail page (T1-C additions).
 *
 * Kept separate from `lib/queries/developments.ts` so the locked query module
 * stays untouched. All functions here are public-read (RLS-gated to
 * `published_at IS NOT NULL`).
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseDeep } from "@/lib/i18n/localise";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import type { DevelopmentIndexRow } from "./developments";

const SIBLING_FIELDS =
  // The two joins carried no `_ar`, so `localiseDeep` below had nothing to
  // fold in them and the sibling cards printed "Saadiyat Island" and the
  // developer's English name on every /ar project page. Selecting the twins
  // is half the fix, the fold is the other half — the same pair
  // `getDeveloperBySlug` documents.
  "id, name, name_ar, slug, status, handover_date, total_units, starting_price, tagline, tagline_ar, bedrooms_text, bedrooms_text_ar, description, description_ar, published_at, developers:developer_id(name, name_ar, slug), areas:area_id(name, name_ar, slug), hero:hero_image_id(storage_key, filename, alt_text, alt_text_ar)";

/** Other developments in the same area, excluding the current one. */
export async function listOtherDevelopmentsInArea(opts: {
  excludeId: string;
  areaId: string;
  limit?: number;
}): Promise<DevelopmentIndexRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select(SIBLING_FIELDS)
    .eq("area_id", opts.areaId)
    .neq("id", opts.excludeId)
    .not("published_at", "is", null)
    .order("handover_date", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 4);
  // `...d` spreads the raw row, so without a fold the twins would ship to the
  // renderer AND the English would win on /ar — both halves of the invariant.
  // `localiseDeep` reaches the alt text inside the `hero` join.
  const rows = localiseDeep(
    (data ?? []) as unknown as Record<string, unknown>[],
    await currentLocale(),
  ) as unknown as DevelopmentIndexRow[];
  return (
    rows.map((d) => ({
      ...d,
      developer:
        (d as unknown as { developers: { name: string; slug: string } | null })
          .developers ?? null,
      area:
        (d as unknown as { areas: { name: string; slug: string } | null })
          .areas ?? null,
    })) ?? []
  );
}

/** Other developments by the same developer, excluding the current one. */
export async function listOtherDevelopmentsByDeveloper(opts: {
  excludeId: string;
  developerId: string;
  limit?: number;
}): Promise<DevelopmentIndexRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select(SIBLING_FIELDS)
    .eq("developer_id", opts.developerId)
    .neq("id", opts.excludeId)
    .not("published_at", "is", null)
    .order("handover_date", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 4);
  // `...d` spreads the raw row, so without a fold the twins would ship to the
  // renderer AND the English would win on /ar — both halves of the invariant.
  // `localiseDeep` reaches the alt text inside the `hero` join.
  const rows = localiseDeep(
    (data ?? []) as unknown as Record<string, unknown>[],
    await currentLocale(),
  ) as unknown as DevelopmentIndexRow[];
  return (
    rows.map((d) => ({
      ...d,
      developer:
        (d as unknown as { developers: { name: string; slug: string } | null })
          .developers ?? null,
      area:
        (d as unknown as { areas: { name: string; slug: string } | null })
          .areas ?? null,
    })) ?? []
  );
}

/**
 * Optional development meta blob — fetched separately from the main detail
 * query so we don't have to change DETAIL_FIELDS in the locked module. Keys
 * we care about:
 *
 *   - meta.feature_blocks: NamedFeatureBlock[]
 *   - meta.faq: { q: string; a: string }[]
 *   - meta.coords: { lat: number; lng: number }
 *   - meta.floorplan_gated: boolean
 *   - meta.is_signature: boolean
 *
 * All optional; the components handle missing data gracefully.
 */
export type DevelopmentMeta = {
  feature_blocks?: NamedFeatureBlock[];
  faq?: FaqEntry[];
  coords?: { lat: number; lng: number };
  floorplan_gated?: boolean;
  is_signature?: boolean;
} & Record<string, unknown>;

export type NamedFeatureBlock = {
  key: string;
  title: string;
  copy: string;
  /** Arabic twins, beside their siblings — see `lib/schemas/development-content.ts`. */
  title_ar?: string | null;
  copy_ar?: string | null;
  /** Media asset chosen in the page editor. */
  media_id?: string | null;
  alt?: string | null;
  /** Public URL, resolved when the page loads — never stored. */
  image_url?: string | null;
  image_role?: string;
};

/**
 * Fold the amenity cards into the reader's language.
 *
 * ## Why this is hand-written rather than `localiseDeep`
 *
 * `localiseRow` only consults the Arabic store for a key whose `_ar` twin is
 * PRESENT on the object — a deliberate guard, so a bare `arabicFor(value)`
 * can't swap an `id` or a price for a coincidental store hit. That guard is
 * exactly wrong here: the 93 blocks already in production were written before
 * the twins existed, so not one of them carries the key that would let the
 * store be consulted, and every amenity card on every `/ar/developments/<slug>`
 * rendered its English. Naming the two fields is what makes the lookup safe
 * without a migration over a free-form jsonb column.
 *
 * ## Precedence
 *
 * 1. `title_ar` / `copy_ar` — what an editor typed in the project editor. It
 *    wins from the moment it is saved, which is the whole point of ADR-0008:
 *    the machine draft is a starting position, not the answer.
 * 2. The Arabic store, keyed by the English — the generated first draft
 *    (`scripts/i18n/translate-content.ts --features`).
 * 3. The English, unchanged. Better a legible English card than a blank one.
 *
 * `alt` is not folded and does not need to be: `FeatureRow` renders
 * `alt ?? title`, and the 93 stored blocks all carry a null `alt`, so the
 * folded title is already what reaches a screen reader.
 */
export function localiseFeatureBlocks<T extends NamedFeatureBlock>(
  blocks: readonly T[] | null | undefined,
  locale: Locale,
): T[] {
  if (!blocks?.length) return [];
  if (locale === DEFAULT_LOCALE) return [...blocks];
  const pick = (typed: string | null | undefined, english: string) => {
    if (typed && typed.trim()) return typed;
    return arabicFor(english) ?? english;
  };
  return blocks.map((b) => ({
    ...b,
    title: pick(b.title_ar, b.title),
    copy: pick(b.copy_ar, b.copy),
  }));
}

export type FaqEntry = {
  q: string;
  a: string;
  /** Arabic twins, beside their siblings — see `lib/schemas/development-content.ts`. */
  q_ar?: string | null;
  a_ar?: string | null;
};

export async function getDevelopmentMeta(
  developmentId: string,
): Promise<DevelopmentMeta | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select("meta")
    .eq("id", developmentId)
    .maybeSingle();
  return (data?.meta as DevelopmentMeta | null) ?? null;
}

/**
 * T2-G cleanup: bulk signature-flag lookup for the developer profile
 * "Signature buildings" carousel.  Returns a Set of development IDs where
 * `meta.is_signature === true`.  When the meta column is unpopulated for
 * a developer's portfolio, the Set is empty and the carousel renders the
 * top N projects as a fallback — graceful degradation.
 */
export async function getSignatureDevelopmentIds(
  ids: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  if (!isSupabaseConfigured || ids.length === 0) return out;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select("id, meta")
    .in("id", ids);
  for (const row of (data as Array<{ id: string; meta: unknown }> | null) ??
    []) {
    const m = row.meta as DevelopmentMeta | null;
    if (m?.is_signature === true) out.add(row.id);
  }
  return out;
}

/**
 * T1-C cleanup: bulk coords lookup for the "Future developments around"
 * map.  Returns a per-id coords record (entries omitted when missing /
 * malformed).  Pulls a single SELECT against developments + filters
 * client-side rather than calling getDevelopmentMeta() N times.
 */
export async function getDevelopmentCoordsBulk(
  ids: string[],
): Promise<Record<string, { lat: number; lng: number } | null>> {
  const out: Record<string, { lat: number; lng: number } | null> = {};
  if (!isSupabaseConfigured || ids.length === 0) return out;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("developments")
    .select("id, meta")
    .in("id", ids);
  for (const row of (data as Array<{ id: string; meta: unknown }> | null) ??
    []) {
    const m = row.meta as DevelopmentMeta | null;
    const c = m?.coords;
    if (
      c &&
      typeof c.lat === "number" &&
      typeof c.lng === "number" &&
      Number.isFinite(c.lat) &&
      Number.isFinite(c.lng)
    ) {
      out[row.id] = { lat: c.lat, lng: c.lng };
    } else {
      out[row.id] = null;
    }
  }
  return out;
}
